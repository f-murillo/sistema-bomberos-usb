import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, subDays, startOfMonth, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

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
    doc.setFont('helvetica', 'bold');
    doc.text(`• Total Minutos Efectivos: ${totalEfectivos} / ${totalProgramados} min`, 20, currentY + offset);
    doc.setFont('helvetica', 'normal');
    
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
    doc.setFont('helvetica', 'bold');
    doc.text(`• Balance del mes: ${infracciones - pagos} min`, 20, currentY + 15);
    doc.setFont('helvetica', 'normal');

    currentY += 20;
  });

  // Guardar el PDF
  const nameSuffix = options.bomberoNombre ? options.bomberoNombre.replace(/\s+/g, '_') : 'General';
  doc.save(`reporte-arrestos-${nameSuffix}-${format(now, 'yyyy-MM-dd')}.pdf`);
};

export const generateGuardsExcel = (guardias: any[], options: { period: 'semanal' | 'mensual', bomberoId?: string, bomberoNombre?: string } = { period: 'mensual' }) => {
  const now = new Date();
  const threshold = options.period === 'semanal' ? subDays(now, 7) : startOfMonth(now);
  let filtered = guardias.filter(g => {
    const fecha = g.fecha?.toDate ? g.fecha.toDate() : new Date(g.fecha);
    return isAfter(fecha, threshold);
  });

  if (options.bomberoId) {
    filtered = filtered.filter(g => g.bomberoId === options.bomberoId);
  }

  const data = filtered.map(g => ({
    'Fecha': format(g.fecha?.toDate ? g.fecha.toDate() : new Date(g.fecha), 'dd/MM/yyyy'),
    'Bombero': g.bomberoNombre || 'Sin Nombre',
    'Turno': g.turno,
    'Sede': g.sede || 'N/A',
    'Estado': g.estado,
    'Minutos Programados': g.minutos || 0,
    'Minutos Efectivos': g.estado === 'COMPLETADA' ? (g.minutosEfectivos ?? g.minutos ?? 0) : 0,
    'Déficit': g.estado === 'COMPLETADA' ? Math.max(0, (g.minutos || 0) - (g.minutosEfectivos ?? g.minutos ?? 0)) : (g.estado === 'INASISTENCIA' ? (g.minutos || 0) : 0)
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalle de Guardias');

  // Calcular resumen por bombero (siempre se añade como segunda pestaña)
  const summaryMap = filtered.reduce((acc: any, g: any) => {
    const id = g.bomberoId || 'unknown';
    if (!acc[id]) acc[id] = { 'Bombero': g.bomberoNombre || 'Sin Nombre', 'Prog.': 0, 'Efect.': 0, 'Déficit': 0 };
    
    const prog = g.minutos || 0;
    const efect = g.estado === 'COMPLETADA' ? (g.minutosEfectivos ?? g.minutos ?? 0) : 0;
    const deficit = g.estado === 'COMPLETADA' ? Math.max(0, prog - efect) : (g.estado === 'INASISTENCIA' ? prog : 0);
    
    acc[id]['Prog.'] += prog;
    acc[id]['Efect.'] += efect;
    acc[id]['Déficit'] += deficit;
    return acc;
  }, {});

  const summaryData = Object.values(summaryMap);
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen de Totales');

  const nameSuffix = options.bomberoNombre ? options.bomberoNombre.replace(/\s+/g, '_') : 'General';
  XLSX.writeFile(workbook, `reporte-guardias-${nameSuffix}-${format(now, 'yyyy-MM-dd')}.xlsx`);
};

export const generateArrestosExcel = (arrestos: any[], options: { period: 'mensual', bomberoId?: string, bomberoNombre?: string } = { period: 'mensual' }) => {
  const now = new Date();
  const threshold = startOfMonth(now);
  let filtered = arrestos.filter(a => isAfter(new Date(a.fechaRegistro), threshold));

  if (options.bomberoId) {
    filtered = filtered.filter(a => a.bomberoId === options.bomberoId);
  }

  const data = filtered.map(a => {
    const mins = Number(a.minutos || 0);
    const balance = a.tipo === 'INFRACCION' ? mins : (mins * (a.pagoDoble ? 2 : 1) * -1);
    return {
      'Fecha Registro': format(new Date(a.fechaRegistro), 'dd/MM/yyyy HH:mm'),
      'Fecha Suceso': format(new Date(a.fecha), 'dd/MM/yyyy'),
      'Bombero': a.bomberoNombre || 'Sin Nombre',
      'Tipo': a.tipo === 'INFRACCION' ? 'Infracción' : 'Pago',
      'Minutos Base': mins,
      'Pago Doble': a.pagoDoble ? 'Sí' : 'No',
      'Impacto Balance': balance,
      'Estado': a.estado,
      'Motivo / Falta': a.falta || a.motivo || 'N/A'
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalle de Arrestos');

  // Calcular resumen de balances (siempre se añade como segunda pestaña)
  const summaryMap = filtered.reduce((acc: any, a: any) => {
    const id = a.bomberoId || 'unknown';
    if (!acc[id]) acc[id] = { 'Bombero': a.bomberoNombre || 'Sin Nombre', 'Infracciones': 0, 'Pagos': 0, 'Balance Final': 0 };
    
    const mins = Number(a.minutos || 0);
    if (a.tipo === 'INFRACCION') {
        acc[id]['Infracciones'] += mins;
        acc[id]['Balance Final'] += mins;
    } else if (a.tipo === 'PAGO' && a.estado === 'PAGADO') {
        const pago = mins * (a.pagoDoble ? 2 : 1);
        acc[id]['Pagos'] += pago;
        acc[id]['Balance Final'] -= pago;
    }
    return acc;
  }, {});

  const summaryData = Object.values(summaryMap);
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen de Balances');

  const nameSuffix = options.bomberoNombre ? options.bomberoNombre.replace(/\s+/g, '_') : 'General';
  XLSX.writeFile(workbook, `reporte-arrestos-${nameSuffix}-${format(now, 'yyyy-MM-dd')}.xlsx`);
};
