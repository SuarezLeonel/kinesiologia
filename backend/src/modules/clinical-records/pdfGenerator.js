import PDFDocument from 'pdfkit';

/**
 * Genera un PDF médico formal y estructurado para una Historia Clínica kinésica.
 * @param {Object} record Datos completos de la historia clínica, paciente y profesional
 * @param {Array} [sessions] Lista de sesiones de tratamiento vinculadas (opcional)
 * @returns {Promise<Buffer>} Buffer del archivo PDF generado
 */
export function generateClinicalRecordPdf(record, sessions = []) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 35, bottom: 45, left: 40, right: 40 },
        bufferPages: true,
        info: {
          Title: `Historia Clínica - ${record.patient_last_name || ''} ${record.patient_first_name || ''}`.trim(),
          Author: `Lic. ${record.author_name || ''} ${record.author_last_name || ''}`.trim(),
          Subject: 'Historia Clínica y Evolución Kinésica',
          Keywords: 'kinesiologia, historia clinica, evaluacion, fisioterapia',
          Creator: 'KinesioGestión'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PRIMARY = '#15803D';
      const PRIMARY_LIGHT = '#F0FDF4';
      const DARK = '#0F172A';
      const SECONDARY = '#334155';
      const MUTED = '#64748B';
      const BORDER_COLOR = '#E2E8F0';
      const CARD_BG = '#F8FAFC';

      const pageWidth = 515; // 595 - 40 - 40
      const startX = 40;

      // ==========================================
      // 1. CABECERA INSTITUCIONAL
      // ==========================================
      const headerY = 35;
      doc.rect(startX, headerY, pageWidth, 58).fill(PRIMARY_LIGHT);
      doc.rect(startX, headerY, 6, 58).fill(PRIMARY);

      // Título y Marca
      doc.fillColor(PRIMARY).fontSize(16).font('Helvetica-Bold')
         .text('KINESIOGESTIÓN', startX + 16, headerY + 10);
      doc.fillColor(SECONDARY).fontSize(8.5).font('Helvetica')
         .text('Centro Integral de Kinesiología y Fisioterapia • Ficha Médica Oficial', startX + 16, headerY + 30);
      doc.fillColor(MUTED).fontSize(7.5).font('Helvetica')
         .text('Registro Clínico Digital conforme a la Ley N° 26.529 de Derechos del Paciente', startX + 16, headerY + 42);

      // Metadata derecha
      const hcCode = `HC-${String(record.id).padStart(6, '0')}`;
      doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold')
         .text(hcCode, startX + pageWidth - 140, headerY + 10, { width: 130, align: 'right' });

      const dateStr = record.created_at
        ? new Date(record.created_at).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : new Date().toLocaleDateString('es-AR');

      doc.fillColor(MUTED).fontSize(8).font('Helvetica')
         .text(`Fecha: ${dateStr}`, startX + pageWidth - 140, headerY + 28, { width: 130, align: 'right' });
      doc.fillColor(PRIMARY).fontSize(7.5).font('Helvetica-Bold')
         .text('DOCUMENTO CONFIDENCIAL', startX + pageWidth - 140, headerY + 42, { width: 130, align: 'right' });

      let currentY = headerY + 70;

      // ==========================================
      // 2. DATOS DEL PACIENTE Y DEL PROFESIONAL
      // ==========================================
      const boxHeight = 76;
      const colWidth = (pageWidth - 10) / 2;

      // Caja Paciente
      doc.rect(startX, currentY, colWidth, boxHeight).fillAndStroke(CARD_BG, BORDER_COLOR);
      doc.rect(startX, currentY, colWidth, 18).fill('#EEF2F6');
      doc.fillColor(SECONDARY).fontSize(8).font('Helvetica-Bold')
         .text('DATOS DEL PACIENTE', startX + 8, currentY + 5);

      const patientName = `${record.patient_last_name || ''}, ${record.patient_first_name || ''}`.trim() || 'Sin especificar';
      const patientDni = record.patient_dni || 'S/N';
      const patientPhone = record.patient_phone || 'No registrado';
      const patientEmail = record.patient_email || 'No registrado';
      const patientAddress = record.patient_address || 'Particular';

      let ageText = '';
      if (record.patient_birth_date) {
        const bdate = new Date(record.patient_birth_date);
        const ageDifMs = Date.now() - bdate.getTime();
        const ageDate = new Date(ageDifMs);
        const years = Math.abs(ageDate.getUTCFullYear() - 1970);
        const bFormatted = bdate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        ageText = ` • ${bFormatted} (${years} años)`;
      }

      doc.fillColor(DARK).fontSize(8.5).font('Helvetica-Bold')
         .text(patientName, startX + 8, currentY + 24, { width: colWidth - 16 });
      doc.fillColor(SECONDARY).fontSize(8).font('Helvetica')
         .text(`DNI: ${patientDni}${ageText}`, startX + 8, currentY + 37, { width: colWidth - 16 });
      doc.fillColor(SECONDARY).fontSize(8).font('Helvetica')
         .text(`Contacto: ${patientPhone} • ${patientEmail}`, startX + 8, currentY + 49, { width: colWidth - 16 });
      doc.fillColor(MUTED).fontSize(7.5).font('Helvetica')
         .text(`Domicilio / Cobertura: ${patientAddress}`, startX + 8, currentY + 61, { width: colWidth - 16 });

      // Caja Profesional
      const profX = startX + colWidth + 10;
      doc.rect(profX, currentY, colWidth, boxHeight).fillAndStroke(CARD_BG, BORDER_COLOR);
      doc.rect(profX, currentY, colWidth, 18).fill('#EEF2F6');
      doc.fillColor(SECONDARY).fontSize(8).font('Helvetica-Bold')
         .text('PROFESIONAL TRATANTE', profX + 8, currentY + 5);

      const authorName = `Lic. ${record.author_name || ''} ${record.author_last_name || ''}`.trim();
      const authorLicense = record.author_license || 'Matrícula en trámite';
      const authorSpecialty = record.author_specialty || 'Kinesiología y Fisiatría';
      const authorContact = record.author_phone || record.author_email || 'Centro KinesioGestión';

      doc.fillColor(DARK).fontSize(8.5).font('Helvetica-Bold')
         .text(authorName, profX + 8, currentY + 24, { width: colWidth - 16 });
      doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold')
         .text(`Matrícula Profesional: ${authorLicense}`, profX + 8, currentY + 37, { width: colWidth - 16 });
      doc.fillColor(SECONDARY).fontSize(8).font('Helvetica')
         .text(`Especialidad: ${authorSpecialty}`, profX + 8, currentY + 49, { width: colWidth - 16 });
      doc.fillColor(MUTED).fontSize(7.5).font('Helvetica')
         .text(`Contacto institucional: ${authorContact}`, profX + 8, currentY + 61, { width: colWidth - 16 });

      currentY += boxHeight + 14;

      // ==========================================
      // 3. DIAGNÓSTICO KINÉSICO Y MOTIVO DE CONSULTA
      // ==========================================
      doc.rect(startX, currentY, pageWidth, 52).fillAndStroke('#F0FDF4', '#86EFAC');
      doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold')
         .text('DIAGNÓSTICO KINÉSICO PRINCIPAL', startX + 12, currentY + 8);
      doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold')
         .text(record.diagnosis || 'Evaluación General Kinésica', startX + 12, currentY + 20, { width: pageWidth - 24 });
      doc.fillColor(SECONDARY).fontSize(8).font('Helvetica')
         .text(`Motivo de Consulta: ${record.consultation_reason || 'Evaluación funcional de rutina'}`, startX + 12, currentY + 36, { width: pageWidth - 24 });

      currentY += 62;

      // ==========================================
      // 4. ESCALA ANALÓGICA VISUAL DEL DOLOR (EVA)
      // ==========================================
      const painLevel = record.reported_pain_level ?? 5;
      let painCategory = 'Moderado';
      let painColor = '#D97706';
      if (painLevel <= 3) {
        painCategory = painLevel === 0 ? 'Sin dolor' : 'Dolor Leve';
        painColor = '#16A34A';
      } else if (painLevel >= 7) {
        painCategory = painLevel === 10 ? 'Máximo Dolor Inhabilitante' : 'Dolor Severo';
        painColor = '#DC2626';
      }

      doc.rect(startX, currentY, pageWidth, 42).fillAndStroke(CARD_BG, BORDER_COLOR);
      doc.fillColor(SECONDARY).fontSize(8).font('Helvetica-Bold')
         .text('ESCALA ANALÓGICA VISUAL DEL DOLOR (EVA):', startX + 12, currentY + 8);

      doc.fillColor(painColor).fontSize(9).font('Helvetica-Bold')
         .text(`${painLevel} / 10 — ${painCategory}`, startX + 220, currentY + 8);

      // Barra visual de dolor (10 bloques)
      const barStartX = startX + 12;
      const barY = currentY + 22;
      const segmentWidth = (pageWidth - 24) / 10;
      for (let i = 0; i < 10; i++) {
        const segX = barStartX + (i * segmentWidth);
        const isActive = (i + 1) <= painLevel;
        let segColor = '#CBD5E1';
        if (isActive) {
          if (i < 3) segColor = '#16A34A';
          else if (i < 6) segColor = '#F59E0B';
          else segColor = '#EF4444';
        }
        doc.rect(segX + 1, barY, segmentWidth - 2, 8).fill(segColor);
        doc.fillColor(isActive ? DARK : MUTED).fontSize(6.5).font('Helvetica')
           .text(String(i + 1), segX + 1, barY + 9, { width: segmentWidth - 2, align: 'center' });
      }

      currentY += 54;

      // Helper para renderizar secciones clínicas con salto automático de página
      function checkPageBreak(requiredHeight) {
        if (currentY + requiredHeight > 780) {
          doc.addPage();
          currentY = 40;
        }
      }

      function renderSection(title, content, defaultText = 'Sin datos consignados') {
        const text = (content && String(content).trim()) ? String(content).trim() : defaultText;
        checkPageBreak(50);

        doc.fillColor(PRIMARY).fontSize(8.5).font('Helvetica-Bold')
           .text(title.toUpperCase(), startX, currentY);
        currentY += 12;

        doc.moveTo(startX, currentY).lineTo(startX + pageWidth, currentY).strokeColor(BORDER_COLOR).stroke();
        currentY += 6;

        doc.fillColor(DARK).fontSize(8.5).font('Helvetica')
           .text(text, startX, currentY, { width: pageWidth, lineGap: 3 });
        
        currentY = doc.y + 12;
      }

      // 5. EVALUACIÓN INICIAL Y EXAMEN FÍSICO
      renderSection('Evaluación Inicial y Examen Físico Funcional', record.initial_evaluation);

      // 6. ANTECEDENTES MÉDICOS
      if (record.medical_history) {
        renderSection('Antecedentes Médicos y Comorbilidades', record.medical_history, 'Sin antecedentes patológicos consignados');
      }

      // 7. MOVILIDAD ARTICULAR (ROM)
      if (record.mobility_evaluation) {
        renderSection('Evaluación de Movilidad y Rangos Articulares (ROM)', record.mobility_evaluation);
      }

      // 8. LIMITACIONES FUNCIONALES
      if (record.functional_limitations) {
        renderSection('Limitaciones Funcionales y de Actividades de la Vida Diaria (AVD)', record.functional_limitations);
      }

      // 9. OBJETIVOS Y PLAN TERAPÉUTICO
      renderSection('Objetivos Terapéuticos y Plan de Tratamiento', record.treatment_goals, 'Rehabilitación y restitución funcional integral');

      // 10. OBSERVACIONES GENERALES
      if (record.general_observations) {
        renderSection('Observaciones Generales y Pautas Domiciliarias', record.general_observations);
      }

      // ==========================================
      // 11. SESIONES DE TRATAMIENTO VINCULADAS
      // ==========================================
      if (Array.isArray(sessions) && sessions.length > 0) {
        checkPageBreak(60);
        doc.fillColor(PRIMARY).fontSize(8.5).font('Helvetica-Bold')
           .text(`EVOLUCIÓN EN SESIONES DE TRATAMIENTO (${sessions.length} REGISTRADAS)`, startX, currentY);
        currentY += 12;
        doc.moveTo(startX, currentY).lineTo(startX + pageWidth, currentY).strokeColor(BORDER_COLOR).stroke();
        currentY += 6;

        sessions.forEach((s) => {
          checkPageBreak(35);
          const sDate = s.session_date ? new Date(s.session_date).toLocaleDateString('es-AR') : 'S/F';
          const sPain = s.pain_level_reported !== null ? `EVA: ${s.pain_level_reported}/10` : 'EVA: N/A';

          doc.rect(startX, currentY, pageWidth, 28).fillAndStroke('#FAFAFA', BORDER_COLOR);
          doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
             .text(`Sesión N° ${s.session_number} (${sDate}) - ${sPain}`, startX + 8, currentY + 4);
          doc.fillColor(SECONDARY).fontSize(7.5).font('Helvetica')
             .text(`Procedimientos: ${s.performed_procedures || 'Terapia manual / agentes físicos'}`, startX + 8, currentY + 15, { width: pageWidth - 16, ellipsis: true });

          currentY += 32;
        });
      }

      // ==========================================
      // 12. PIE MÉDICO-LEGAL Y FIRMA
      // ==========================================
      checkPageBreak(90);
      currentY += 10;

      const signWidth = 200;
      const signX = startX + pageWidth - signWidth;
      doc.moveTo(signX, currentY + 30).lineTo(signX + signWidth, currentY + 30).strokeColor(DARK).stroke();

      doc.fillColor(DARK).fontSize(8.5).font('Helvetica-Bold')
         .text(authorName, signX, currentY + 34, { width: signWidth, align: 'center' });
      doc.fillColor(SECONDARY).fontSize(7.5).font('Helvetica')
         .text(authorLicense, signX, currentY + 45, { width: signWidth, align: 'center' });
      doc.fillColor(MUTED).fontSize(7).font('Helvetica')
         .text(authorSpecialty, signX, currentY + 55, { width: signWidth, align: 'center' });

      // Leyenda legal
      doc.fillColor(MUTED).fontSize(6.5).font('Helvetica')
         .text(
           'Constancia médica emitida electrónicamente por KinesioGestión. Documento confeccionado según las directrices de la Ley 26.529 de Derechos del Paciente y Confidencialidad Médica. El secreto profesional ampara todos los datos vertidos en este informe.',
           startX,
           currentY + 25,
           { width: pageWidth - signWidth - 20, lineGap: 2 }
         );

      // ==========================================
      // 13. PAGINACIÓN Y PIE DE PÁGINA
      // ==========================================
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const footerY = 805;
        doc.moveTo(startX, footerY).lineTo(startX + pageWidth, footerY).strokeColor(BORDER_COLOR).stroke();
        doc.fillColor(MUTED).fontSize(7).font('Helvetica')
           .text('KinesioGestión • Consultorio de Kinesiología y Fisioterapia', startX, footerY + 5, { lineBreak: false });
        doc.fillColor(MUTED).fontSize(7).font('Helvetica')
           .text(`Página ${i + 1} de ${range.count}`, startX + pageWidth - 100, footerY + 5, { width: 100, align: 'right', lineBreak: false });

        doc.page.margins.bottom = oldBottom;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

