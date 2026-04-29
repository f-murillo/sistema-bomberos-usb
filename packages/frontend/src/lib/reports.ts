import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, subDays, startOfMonth, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';

export const generateGuardsReport = (guardias: any[], period: 'semanal' | 'mensual') => {
  const doc = new jsPDF();
  const now = new Date();
  
  // Filtrar según el periodo
  const threshold = period === 'semanal' ? subDays(now, 7) : startOfMonth(now);
  const guardiasPeriodo = guardias.filter(g => isAfter(new Date(g.fechaInicio), threshold));

  const periodTitle = period === 'semanal' ? 'Últimos 7 Días' : 'Mes en Curso';
  const title = `Reporte de Guardias - ${periodTitle}`;
  
  // Configuración de fuentes y cabecera
  doc.setFontSize(18);
  doc.setTextColor(33, 37, 41);
  doc.text('Cuerpo de Bomberos Voluntarios USB', 105, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(100, 116, 139);
  doc.text(title, 105, 30, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Fecha de generación: ${format(now, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}`, 105, 38, { align: 'center' });

  // Definir columnas y datos de la tabla
  const columns = [
    { header: 'Fecha', dataKey: 'fecha' },
    { header: 'Bombero', dataKey: 'bombero' },
    { header: 'Estado', dataKey: 'estado' },
    { header: 'Horario', dataKey: 'horario' },
    { header: 'Observaciones', dataKey: 'observaciones' }
  ];

  const tableData = guardiasPeriodo.map(g => ({
    fecha: format(new Date(g.fechaInicio), 'dd/MM/yyyy'),
    bombero: g.bomberoNombre || 'N/A',
    estado: g.estado,
    horario: `${format(new Date(g.fechaInicio), 'HH:mm')} - ${format(new Date(g.fechaFin), 'HH:mm')}`,
    observaciones: g.observaciones || '-'
  }));

  // Generar tabla
  autoTable(doc, {
    startY: 45,
    columns: columns,
    body: tableData,
    theme: 'grid',
    headStyles: { 
      fillColor: [30, 41, 59], 
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold'
    },
    bodyStyles: { fontSize: 10 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 45 },
  });

  // Resumen estadístico
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  if (finalY < 270) {
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Resumen Estadístico:', 14, finalY);
    
    const stats = guardiasPeriodo.reduce((acc: any, g: any) => {
      acc[g.estado] = (acc[g.estado] || 0) + 1;
      return acc;
    }, {});

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    let offset = 8;
    
    const total = guardiasPeriodo.length;
    doc.text(`Total de guardias en el periodo: ${total}`, 14, finalY + offset);
    offset += 6;

    Object.entries(stats).forEach(([estado, count]) => {
      doc.text(`• ${estado}: ${count}`, 20, finalY + offset);
      offset += 6;
    });
  }

  // Guardar el PDF
  const fileName = `reporte-guardias-${period}-${format(now, 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};
