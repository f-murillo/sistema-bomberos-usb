import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, subDays, startOfMonth, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';

export const generateGuardsReport = (guardias: any[], options: { period: 'semanal' | 'mensual', bomberoId?: string, bomberoNombre?: string } = { period: 'mensual' }) => {
  const doc = new jsPDF();
  const now = new Date();
  
  // Filtrar según el periodo
  const threshold = options.period === 'semanal' ? subDays(now, 7) : startOfMonth(now);
  let filtered = guardias.filter(g => {
    const fecha = g.fecha?.toDate ? g.fecha.toDate() : new Date(g.fecha);
    return isAfter(fecha, threshold);
  });

  // Filtrar por bombero si se solicita
  if (options.bomberoId) {
    filtered = filtered.filter(g => g.bomberoId === options.bomberoId);
  }

  const periodTitle = options.period === 'semanal' ? 'Últimos 7 Días' : 'Mes en Curso';
  const title = options.bomberoNombre 
    ? `Reporte de Guardias: ${options.bomberoNombre}`
    : `Reporte General de Guardias - ${periodTitle}`;
  
  // Cabecera principal
  doc.setFontSize(18);
  doc.setTextColor(33, 37, 41);
  doc.text('Cuerpo de Bomberos Voluntarios USB', 105, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(100, 116, 139);
  doc.text(title, 105, 30, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Fecha de generación: ${format(now, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}`, 105, 38, { align: 'center' });

  // Agrupar por bombero si es reporte general
  const grouped = filtered.reduce((acc: any, curr: any) => {
    const id = curr.bomberoId || 'unknown';
    const nombre = curr.bomberoNombre || 'Sin Nombre';
    if (!acc[id]) acc[id] = { nombre, items: [] };
    acc[id].items.push(curr);
    return acc;
  }, {});

  let currentY = 45;

  Object.values(grouped).forEach((group: any, index: number) => {
    // Nueva página si es necesario
    if (index > 0) {
        if (currentY > 220) {
            doc.addPage();
            currentY = 20;
        } else {
            currentY += 10;
        }
    }

    if (!options.bomberoId) {
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text(`Funcionario: ${group.nombre}`, 14, currentY);
        currentY += 5;
    }

    const columns = [
        { header: 'Fecha', dataKey: 'fecha' },
        { header: 'Turno', dataKey: 'turno' },
        { header: 'Sede', dataKey: 'sede' },
        { header: 'Estado', dataKey: 'estado' },
        { header: 'Minutos', dataKey: 'minutos' }
    ];

    const tableData = group.items.map((g: any) => ({
        fecha: format(g.fecha?.toDate ? g.fecha.toDate() : new Date(g.fecha), 'dd/MM/yyyy'),
        turno: g.turno,
        sede: g.sede || 'N/A',
        estado: g.estado,
        minutos: g.estado === 'COMPLETADA' && g.minutosEfectivos !== undefined && g.minutosEfectivos !== g.minutos 
            ? `${g.minutosEfectivos} / ${g.minutos} min` 
            : `${g.minutosEfectivos ?? g.minutos} min`
    }));

    autoTable(doc, {
        startY: currentY,
        columns: columns,
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { top: 20 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Resumen para el bombero
    const stats = group.items.reduce((acc: any, g: any) => {
        acc[g.estado] = (acc[g.estado] || 0) + 1;
        return acc;
    }, {});

    const totalEfectivos = group.items
        .reduce((sum: number, g: any) => {
            if (g.estado === 'COMPLETADA') return sum + (g.minutosEfectivos ?? g.minutos ?? 0);
            return sum;
        }, 0);
    
    const totalProgramados = group.items
        .reduce((sum: number, g: any) => sum + (g.minutos ?? 0), 0);

    const deficit = totalProgramados - totalEfectivos;

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Cumplimiento para ${group.nombre}:`, 14, currentY);
    
    let offset = 5;
    Object.entries(stats).forEach(([estado, count]) => {
        doc.text(`• ${estado}: ${count}`, 20, currentY + offset);
        offset += 5;
    });
    doc.setFont(undefined, 'bold');
    doc.text(`• Total Minutos Efectivos: ${totalEfectivos} / ${totalProgramados} min`, 20, currentY + offset);
    doc.setFont(undefined, 'normal');
    
    if (deficit > 0) {
        offset += 5;
        doc.setTextColor(185, 28, 28); // Rojo destructivo
        doc.text(`• Déficit de Minutos: ${deficit} min`, 20, currentY + offset);
        doc.setTextColor(71, 85, 105);
    }

    currentY += offset + 10;
  });

  // Guardar el PDF
  const nameSuffix = options.bomberoNombre ? options.bomberoNombre.replace(/\s+/g, '_') : 'General';
  doc.save(`reporte-guardias-${nameSuffix}-${format(now, 'yyyy-MM-dd')}.pdf`);
};

export const generateArrestosReport = (arrestos: any[], options: { period: 'mensual', bomberoId?: string, bomberoNombre?: string } = { period: 'mensual' }) => {
  const doc = new jsPDF();
  const now = new Date();
  
  // Filtrar según el periodo (mes en curso)
  const threshold = startOfMonth(now);
  let filtered = arrestos.filter(a => isAfter(new Date(a.fechaRegistro), threshold));

  // Si se especificó un bombero, filtramos solo para él
  if (options.bomberoId) {
    filtered = filtered.filter(a => a.bomberoId === options.bomberoId);
  }

  const title = options.bomberoNombre 
    ? `Reporte de Arrestos: ${options.bomberoNombre}`
    : `Reporte General de Arrestos - Mes en Curso`;
  
  // Cabecera principal
  doc.setFontSize(18);
  doc.setTextColor(33, 37, 41);
  doc.text('Cuerpo de Bomberos Voluntarios USB', 105, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(100, 116, 139);
  doc.text(title, 105, 30, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Fecha de generación: ${format(now, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}`, 105, 38, { align: 'center' });

  // Agrupar por bombero si es reporte general
  const grouped = filtered.reduce((acc: any, curr: any) => {
    const id = curr.bomberoId || 'unknown';
    const nombre = curr.bomberoNombre || 'Sin Nombre';
    if (!acc[id]) acc[id] = { nombre, items: [] };
    acc[id].items.push(curr);
    return acc;
  }, {});

  let currentY = 45;

  Object.values(grouped).forEach((group: any, index: number) => {
    // Si no es el primer bombero, añadir nueva página o espacio
    if (index > 0) {
        if (currentY > 200) {
            doc.addPage();
            currentY = 20;
        } else {
            currentY += 15;
        }
    }

    // Nombre del bombero como subtítulo si es reporte general
    if (!options.bomberoId) {
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text(`Bombero: ${group.nombre}`, 14, currentY);
        currentY += 5;
    }

    const columns = [
        { header: 'Fecha', dataKey: 'fecha' },
        { header: 'Tipo', dataKey: 'tipo' },
        { header: 'Minutos', dataKey: 'minutos' },
        { header: 'Estado', dataKey: 'estado' },
        { header: 'Detalles', dataKey: 'detalles' }
    ];

    const tableData = group.items.map((a: any) => {
        const mins = Number(a.minutos || 0);
        return {
            fecha: format(new Date(a.fechaRegistro), 'dd/MM/yyyy'),
            tipo: a.tipo === 'INFRACCION' ? 'Infracción' : 'Pago',
            minutos: a.tipo === 'INFRACCION' ? `+${mins}` : `-${mins * (a.pagoDoble ? 2 : 1)}`,
            estado: a.estado,
            detalles: a.tipo === 'INFRACCION' 
              ? `${a.falta || 'Falta'}: ${a.motivo || 'N/A'}`
              : `Doble: ${a.pagoDoble ? 'Sí' : 'No'}${a.observaciones ? `, Obs: ${a.observaciones}` : ''}`
        };
    });

    autoTable(doc, {
        startY: currentY,
        columns: columns,
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { top: 20 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Estadísticas para este bombero
    let infracciones = 0;
    let pagos = 0;
    group.items.forEach((a: any) => {
        const mins = Number(a.minutos || 0);
        if (a.tipo === 'INFRACCION') {
            infracciones += mins;
        }
        if (a.tipo === 'PAGO' && a.estado === 'PAGADO') {
            pagos += a.pagoDoble ? mins * 2 : mins;
        }
    });

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Resumen para ${group.nombre}:`, 14, currentY);
    doc.text(`• Total Infracciones: +${infracciones} min`, 20, currentY + 5);
    doc.text(`• Total Pagos Validados: -${pagos} min`, 20, currentY + 10);
    doc.setFont(undefined, 'bold');
    doc.text(`• Balance del mes: ${infracciones - pagos} min`, 20, currentY + 15);
    doc.setFont(undefined, 'normal');

    currentY += 20;
  });

  // Guardar el PDF
  const nameSuffix = options.bomberoNombre ? options.bomberoNombre.replace(/\s+/g, '_') : 'General';
  doc.save(`reporte-arrestos-${nameSuffix}-${format(now, 'yyyy-MM-dd')}.pdf`);
};
