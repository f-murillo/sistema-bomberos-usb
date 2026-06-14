import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, subDays, startOfMonth, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { type Usuario, type Arresto, REGLAS_CONDICION } from '@bomberos-usb/shared';

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

export const generateGuardsExcel = async (guardias: any[], options: { period: 'mensual', bomberoId?: string, bomberoNombre?: string } = { period: 'mensual' }) => {
  const now = new Date();
  const threshold = startOfMonth(now);
  let filtered = guardias.filter(g => isAfter(new Date(g.fecha?.toDate ? g.fecha.toDate() : g.fecha), threshold));

  if (options.bomberoId) {
    filtered = filtered.filter(g => g.bomberoId === options.bomberoId);
  }

  const workbook = new ExcelJS.Workbook();
  const detailSheet = workbook.addWorksheet('Detalle de Guardias');

  // 1. Hoja de Detalle
  detailSheet.columns = [
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Bombero', key: 'nombre', width: 25 },
    { header: 'Turno', key: 'turno', width: 12 },
    { header: 'Sede', key: 'sede', width: 15 },
    { header: 'Estado', key: 'estado', width: 15 },
    { header: 'Min. Programados', key: 'prog', width: 18 },
    { header: 'Min. Efectivos', key: 'efect', width: 18 },
    { header: 'Déficit', key: 'deficit', width: 12 }
  ];

  detailSheet.getRow(1).font = { bold: true };
  detailSheet.getRow(1).eachCell(cell => {
    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFF8F9FA'} };
  });

  filtered.forEach(g => {
    const prog = g.minutos || 0;
    const efect = g.estado === 'COMPLETADA' ? (g.minutosEfectivos ?? g.minutos ?? 0) : 0;
    const deficit = g.estado === 'COMPLETADA' ? Math.max(0, prog - efect) : (g.estado === 'INASISTENCIA' ? prog : 0);
    
    const row = detailSheet.addRow({
      fecha: format(g.fecha?.toDate ? g.fecha.toDate() : new Date(g.fecha), 'dd/MM/yyyy'),
      nombre: g.bomberoNombre || 'Sin Nombre',
      turno: g.turno,
      sede: g.sede || 'N/A',
      estado: g.estado,
      prog: prog,
      efect: efect,
      deficit: deficit
    });
    row.eachCell(cell => {
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
  });

  // 2. Hoja de Resumen
  const summarySheet = workbook.addWorksheet('Resumen de Totales');
  summarySheet.columns = [
    { header: 'Bombero', key: 'nombre', width: 35 },
    { header: 'Min. Programados', key: 'prog', width: 18 },
    { header: 'Min. Efectivos', key: 'efect', width: 18 },
    { header: 'Déficit', key: 'deficit', width: 15 }
  ];

  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).eachCell(cell => {
    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE9ECEF'} };
  });

  const summaryMap = filtered.reduce((acc: any, g: any) => {
    const id = g.bomberoId || 'unknown';
    if (!acc[id]) acc[id] = { nombre: g.bomberoNombre || 'Sin Nombre', prog: 0, efect: 0, deficit: 0 };
    
    const prog = g.minutos || 0;
    const efect = g.estado === 'COMPLETADA' ? (g.minutosEfectivos ?? g.minutos ?? 0) : 0;
    const deficit = g.estado === 'COMPLETADA' ? Math.max(0, prog - efect) : (g.estado === 'INASISTENCIA' ? prog : 0);
    
    acc[id].prog += prog;
    acc[id].efect += efect;
    acc[id].deficit += deficit;
    return acc;
  }, {});

  Object.values(summaryMap).forEach((val: any) => {
    const row = summarySheet.addRow(val);
    row.eachCell(cell => {
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
  });

  const nameSuffix = options.bomberoNombre ? options.bomberoNombre.replace(/\s+/g, '_') : 'General';
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `reporte-guardias-${nameSuffix}-${format(now, 'yyyy-MM-dd')}.xlsx`);
};

export const generateArrestosExcel = async (arrestos: Arresto[], options: { period: 'mensual', bomberoId?: string, bomberoNombre?: string } = { period: 'mensual' }) => {
  const now = new Date();
  const threshold = startOfMonth(now);
  let filtered = arrestos.filter(a => isAfter(new Date(a.fechaRegistro), threshold));

  if (options.bomberoId) {
    filtered = filtered.filter(a => a.bomberoId === options.bomberoId);
  }

  const workbook = new ExcelJS.Workbook();
  const detailSheet = workbook.addWorksheet('Detalle de Arrestos');

  // 1. Configurar Hoja de Detalle
  detailSheet.columns = [
    { header: 'Fecha Registro', key: 'reg', width: 22 },
    { header: 'Fecha Suceso', key: 'suc', width: 15 },
    { header: 'Bombero', key: 'nombre', width: 25 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Minutos Base', key: 'mins', width: 14 },
    { header: 'Pago Doble', key: 'doble', width: 12 },
    { header: 'Impacto Balance', key: 'balance', width: 16 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Motivo / Falta', key: 'motivo', width: 40 }
  ];

  // Estilo encabezado detalle
  detailSheet.getRow(1).font = { bold: true };
  detailSheet.getRow(1).alignment = { horizontal: 'center' };
  detailSheet.getRow(1).eachCell(cell => {
    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFF8F9FA'} };
  });

  filtered.forEach(a => {
    const mins = Number(a.minutos || 0);
    const balance = a.tipo === 'INFRACCION' ? mins : (mins * (a.pagoDoble ? 2 : 1) * -1);
    const row = detailSheet.addRow({
      reg: format(new Date(a.fechaRegistro), 'dd/MM/yyyy HH:mm'),
      suc: format(new Date(a.fecha), 'dd/MM/yyyy'),
      nombre: a.bomberoNombre || 'Sin Nombre',
      tipo: a.tipo === 'INFRACCION' ? 'Infracción' : 'Pago',
      mins: mins,
      doble: a.pagoDoble ? 'Sí' : 'No',
      balance: balance,
      estado: a.estado,
      motivo: a.falta || a.motivo || 'N/A'
    });
    row.eachCell(cell => {
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
  });

  // 2. Configurar Hoja de Resumen
  const summarySheet = workbook.addWorksheet('Resumen de Balances');
  summarySheet.columns = [
    { header: 'Bombero', key: 'nombre', width: 35 },
    { header: 'Infracciones (+)', key: 'plus', width: 18 },
    { header: 'Pagos (-)', key: 'minus', width: 18 },
    { header: 'Balance Final', key: 'final', width: 20 }
  ];

  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).eachCell(cell => {
    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE9ECEF'} };
  });

  const summaryMap = filtered.reduce((acc: any, a: any) => {
    const id = a.bomberoId || 'unknown';
    if (!acc[id]) acc[id] = { nombre: a.bomberoNombre || 'Sin Nombre', plus: 0, minus: 0, final: 0 };
    
    const mins = Number(a.minutos || 0);
    if (a.tipo === 'INFRACCION') {
        acc[id].plus += mins;
        acc[id].final += mins;
    } else if (a.tipo === 'PAGO' && a.estado === 'PAGADO') {
        const pago = mins * (a.pagoDoble ? 2 : 1);
        acc[id].minus += pago;
        acc[id].final -= pago;
    }
    return acc;
  }, {});

  Object.values(summaryMap).forEach((val: any) => {
    const row = summarySheet.addRow(val);
    row.eachCell(cell => {
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
  });

  const nameSuffix = options.bomberoNombre ? options.bomberoNombre.replace(/\s+/g, '_') : 'General';
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `reporte-arrestos-${nameSuffix}-${format(now, 'yyyy-MM-dd')}.xlsx`);
};

/**
 * Genera el reporte consolidado de balances (Imagen 3 del requerimiento) usando ExcelJS para estilos
 */
export const generateArrestosGeneralExcel = async (usuarios: Usuario[]) => {
  const now = new Date();
  const dateStr = format(now, 'dd/MM/yyyy');
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Resumen de Balances');

  // 1. Título principal unificado
  worksheet.mergeCells('A1:G1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `Minutos de Arresto al ${dateStr}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE9ECEF' }
  };
  titleCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  // 2. Definir columnas y encabezados
  worksheet.getRow(2).values = ['Nº', 'Personal', 'Jerarquía', 'Condición', 'Minutos', 'Límite', 'Estado'];
  worksheet.columns = [
    { key: 'num', width: 5 },
    { key: 'nombre', width: 35 },
    { key: 'rango', width: 18 },
    { key: 'condicion', width: 18 },
    { key: 'minutos', width: 12 },
    { key: 'limite', width: 12 },
    { key: 'estado', width: 12 }
  ];

  // Estilo para encabezados (Fila 2)
  const headerRow = worksheet.getRow(2);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8F9FA' }
    };
  });

  // 3. Agregar datos
  const filteredUsers = usuarios
    .filter(u => u.rol === 'BOMBERO')
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  filteredUsers.forEach((u, index) => {
    const condicion = u.condicion || 'REGULAR';
    const reglas = REGLAS_CONDICION[condicion] || REGLAS_CONDICION['REGULAR'];
    const balance = u.minutosArresto || 0;
    const isExcedido = balance >= reglas.maxMinutosArresto;

    const row = worksheet.addRow({
      num: index + 1,
      nombre: u.nombre,
      rango: u.rango || 'N/A',
      condicion: condicion,
      minutos: balance,
      limite: reglas.maxMinutosArresto,
      estado: isExcedido ? 'EXCEDIDO' : 'NORMAL'
    });

    // Bordes para todas las celdas de la fila
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Si está excedido, pintar la fila de rojo (suave) o solo el texto
      if (isExcedido) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCC' } // Rojo claro
        };
        cell.font = { color: { argb: 'FF990000' }, bold: true };
      }

      // Alinear Nº y Números al centro
      if (colNumber === 1 || colNumber >= 5) {
        cell.alignment = { horizontal: 'center' };
      }
    });
  });

  // 4. Generar y descargar el archivo
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `balance-general-arrestos-${format(now, 'yyyy-MM-dd')}.xlsx`);
};

/**
 * Genera una plantilla Excel para el registro masivo de usuarios
 */
export const generarPlantillaUsuariosExcel = async (rolUsuario?: string) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Usuarios');

  // Configurar las columnas
  worksheet.columns = [
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Email', key: 'email', width: 35 },
    { header: 'Teléfono', key: 'telefono', width: 20, style: { numFmt: '@' } },
    { header: 'Rol', key: 'rol', width: 25 },
    { header: 'Jerarquía / Rango', key: 'rango', width: 25 },
    { header: 'Condición de Servicio', key: 'condicion', width: 25 },
    { header: 'Estado Inicial', key: 'estado', width: 15 }
  ];

  // Estilizar encabezados
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9ECEF' } };
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    };
  });

  // Opciones para las listas desplegables
  let roles = '"ADMIN,SUPERVISOR,CUENTA_ADMINISTRATIVA,BOMBERO"';
  if (rolUsuario === 'SUPERVISOR') {
    roles = '"CUENTA_ADMINISTRATIVA,BOMBERO"';
  } else if (rolUsuario === 'CUENTA_ADMINISTRATIVA') {
    roles = '"BOMBERO"';
  }
  const rangos = '"ASP/ALUM,BOMBERO_RASO,CABO_PRIMERO,CABO_SEGUNDO,SARGENTO_PRIMERO,SARGENTO_SEGUNDO,SARGENTO_MAYOR,TENIENTE,CAPITAN,MAYOR,TENIENTE_CORONEL,CORONEL,DISTINGUIDO,N/A"';
  const condiciones = '"REGULAR,TESISTA,COMANDANTE,EX_COMANDANTE,EGRESADO,ESPECIAL_12H"';
  const estados = '"Activo,Inactivo"';

  // Aplicar validación de datos a unas 500 filas para que tengan el formato y los desplegables
  for (let i = 2; i <= 500; i++) {
    // Rol
    worksheet.getCell(`D${i}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [roles],
      showErrorMessage: true,
      errorTitle: 'Rol inválido',
      error: 'Por favor selecciona un rol de la lista.'
    };
    
    // Jerarquía / Rango
    worksheet.getCell(`E${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [rangos],
      showErrorMessage: true,
      errorTitle: 'Rango inválido',
      error: 'Por favor selecciona un rango de la lista.'
    };

    // Condición
    worksheet.getCell(`F${i}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [condiciones],
      showErrorMessage: true,
      errorTitle: 'Condición inválida',
      error: 'Por favor selecciona una condición de la lista.'
    };

    // Estado Inicial
    worksheet.getCell(`G${i}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [estados],
      showErrorMessage: true,
      errorTitle: 'Estado inválido',
      error: 'Por favor selecciona un estado de la lista.'
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `plantilla-usuarios-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};
