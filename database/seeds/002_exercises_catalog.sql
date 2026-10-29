-- 014_seed_clinical_exercises_catalog.sql
-- Catálogo inicial de 90 ejercicios de kinesiología y rehabilitación musculoesquelética
-- Contenido de referencia demostrativo que requiere revisión profesional antes de utilizarse clínicamente.

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Retracción cervical en decúbito supino (Chin-Tuck)',
  'Control Motor',
  'Activación aislada de la musculatura prevertebral cervical profunda para restaurar la estabilidad cervicocraneal.',
  'En decúbito supino con rodillas flexionadas, realizar una ligera flexión craneocervical proyectando el mentón hacia la nuez de Adán sin levantar la cabeza ni tensar el esternocleidomastoideo. Mantener 5 segundos y relajar.',
  3,
  10,
  NULL,
  1,
  'Columna Cervical',
  'Flexores profundos de cuello (largo del cuello, largo de la cabeza)',
  'Control Motor / Propiocepción',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender ante mareo, náuseas, dolor radicular o sensación de opresión faríngea.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Retracción cervical en decúbito supino (Chin-Tuck)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Isometría cervical multidireccional manual',
  'Isométrico',
  'Fortalecimiento isométrico de estabilizadores cervicales en plano sagital y coronal sin inducir cizallamiento articular.',
  'Colocar la palma en la frente, occipucio o laterales de la cabeza. Ejercer una fuerza suave contra la resistencia manual manteniendo la cabeza en posición neutra durante 6 segundos sin producir movimiento.',
  3,
  8,
  NULL,
  1,
  'Columna Cervical',
  'Paravertebrales cervicales y trapecio superior',
  'Fortalecimiento Muscular',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado en dolor agudo cervical reciente o radiculopatía cervical con déficit motor.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Isometría cervical multidireccional manual');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Inclinaciones laterales cervicales activas asistidas',
  'Movilidad Articular',
  'Ganancia progresiva de rango de flexión lateral cervical sin compensaciones escapulares.',
  'Sentado erguido, inclinar suavemente la oreja hacia el hombro homolateral sin elevar el hombro contrario. Regresar al centro lentamente y alternar de lado sin forzar rangos dolorosos.',
  2,
  10,
  NULL,
  1,
  'Columna Cervical',
  'Escalenos y trapecio superior',
  'Movilidad Articular',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido clínico de demostración. Suspender ante cervicobraquialgia punzante o parestesias irradiadas a dedos.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Inclinaciones laterales cervicales activas asistidas');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Rotación cervical segmentaria con pauta visual',
  'Movilidad Articular',
  'Restauración del rango de rotación atlantoaxoidea y subaxial respetando el plano horizontal.',
  'Sentado con la espalda apoyada, girar la cabeza hacia la derecha fijando la vista en un punto horizonte hasta el tope articular confortable, pausar 2 segundos y rotar hacia la izquierda.',
  2,
  10,
  NULL,
  1,
  'Columna Cervical',
  'Rotadores cervicales y esplenio de la cabeza',
  'Movilidad Articular',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No realizar en caso de insuficiencia vértebro-basilar conocida o test de Klein positivo.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Rotación cervical segmentaria con pauta visual');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Extensión cervicotorácica en decúbito prono con apoyo de antebrazos',
  'Fortalecimiento',
  'Reeducación de la extensión alta sin hiperextensión suboccipital, integrando charnela cervicotorácica.',
  'Acostado boca abajo apoyado en codos, alinear la columna, retraer el mentón y extender suavemente la columna cervical superior manteniendo la mirada hacia el suelo sin colapsar las vértebras bajas.',
  3,
  8,
  NULL,
  1,
  'Columna Cervical',
  'Extensores cervicales profundos y erectores torácicos',
  'Reeducación Postural',
  'Colchoneta',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender ante compresión foraminal o dolor facetario posterior agudo.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Extensión cervicotorácica en decúbito prono con apoyo de antebrazos');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Estiramiento del músculo elevador de la escápula',
  'Estiramiento',
  'Elongación selectiva del angular del omóplato para aliviar tensión cérvico-escapular.',
  'Sentado, rotar la cabeza 45 grados hacia un lado y flexionar el cuello como mirando la axila. Con la mano del mismo lado ejercer una suave tracción mientras la otra mano fija el borde de la silla.',
  3,
  3,
  NULL,
  1,
  'Columna Cervical',
  'Elevador de la escápula',
  'Flexibilidad',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar tirones bruscos o presión excesiva.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Estiramiento del músculo elevador de la escápula');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Estiramiento de trapecio superior con descenso escapular',
  'Estiramiento',
  'Disminución del tono hipertónico en la porción descendente del músculo trapecio.',
  'Sentado, descender activamente el hombro ipsilateral. Inclinar la cabeza hacia el hombro contrario con ligera tracción manual sin rotar la cabeza. Sostener 20-30 segundos de manera controlada.',
  3,
  3,
  NULL,
  1,
  'Columna Cervical',
  'Trapecio superior',
  'Flexibilidad',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No forzar en sospecha de plexopatía braquial por tracción.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Estiramiento de trapecio superior con descenso escapular');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Retracción cervical resistida con banda elástica suave',
  'Fortalecimiento',
  'Carga progresiva sobre la retracción cervical horizontal para corrección del síndrome de cabeza adelantada.',
  'Pasar la banda por detrás del occipucio sujetándola al frente a la altura de los ojos. Empujar suavemente la cabeza hacia atrás contra la banda manteniendo el plano horizontal sin flexionar cuello.',
  3,
  10,
  NULL,
  1,
  'Columna Cervical',
  'Flexores profundos y fijadores de escápula',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar resistencias elásticas duras que induzcan compensación con mandíbula.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Retracción cervical resistida con banda elástica suave');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Propiocepción cérvico-ocular con fijación de diana',
  'Propiocepción',
  'Reeducación de la coordinación oculocervical y control sensorimotor cervical en pacientes con latigazo o inestabilidad.',
  'Mantener la mirada fija en una tarjeta o punto a 1 metro de distancia mientras se realizan rotaciones lentas de cabeza a izquierda y derecha sin perder nitidez visual ni generar saltos oculares.',
  3,
  12,
  NULL,
  1,
  'Columna Cervical',
  'Musculatura suboccipital y propioceptores cervicales',
  'Control Motor / Propiocepción',
  'Sin equipamiento',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender de inmediato si se presenta vértigo periférico, nistagmo espontáneo o ataxia.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Propiocepción cérvico-ocular con fijación de diana');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Tracción axial cervical activa en bipedestación',
  'Reeducación Postural',
  'Descompresión intervertebral activa mediante autocrecimiento axial y control cinemático.',
  'De pie contra la pared, imaginar un hilo tirando de la coronilla hacia el techo, alineando nuca y espalda con el mentón levemente recogido. Mantener respirando normalmente durante 15 segundos.',
  3,
  5,
  NULL,
  1,
  'Columna Cervical',
  'Erectores espinales cervicales y core',
  'Reeducación Postural',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Sin contraindicaciones mecánicas absolutas en ausencia de dolor agudo.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Tracción axial cervical activa en bipedestación');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Rotación torácica en cuadrúpedia (Thread the Needle)',
  'Movilidad Articular',
  'Disociación dorsolumbar y apertura de la caja torácica en rotación sin compensación pélvica.',
  'En posición de cuatro apoyos, pasar un brazo por debajo del tronco girando el tórax. Luego abrir ese mismo brazo hacia el techo siguiendo la mano con la mirada sin desplazar la pelvis.',
  3,
  8,
  NULL,
  1,
  'Columna Dorsal',
  'Multífidos torácicos, romboides y oblicuos',
  'Movilidad Articular',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Precaución en osteoporosis severa o fractura costal en consolidación.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Rotación torácica en cuadrúpedia (Thread the Needle)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Extensión dorsal sobre rollo de espuma (Foam roller)',
  'Movilidad Articular',
  'Restauración de la lordosis o disminución de cifosis dorsal rígida mediante fulcro dinámico.',
  'Colocar el rodillo perpendicular a la columna torácica media, manos detrás de la cabeza para proteger el cuello y extender suavemente la parte media de la espalda sobre el rodillo durante la exhalación.',
  3,
  10,
  NULL,
  1,
  'Columna Dorsal',
  'Erectores espinales torácicos e intercostales',
  'Movilidad Articular',
  'Rollo de espuma (Foam roller)',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No aplicar sobre columna lumbar ni en fracturas osteoporóticas vertebrales.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Extensión dorsal sobre rollo de espuma (Foam roller)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Retracción escapular con banda elástica (Remo bajo escapular)',
  'Fortalecimiento',
  'Activación y coaptación escapulotorácica para estabilización postural de espalda alta.',
  'Con banda anclada al frente, traccionar los codos hacia atrás pegados al tronco, juntando conscientemente las escápulas sin elevar los hombros hacia las orejas.',
  3,
  12,
  NULL,
  1,
  'Columna Dorsal',
  'Romboides mayor y menor, trapecio medio e inferior',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido de demostración. Contraindicado en luxación esternoclavicular aguda o bursitis escapulotorácica dolorosa.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Retracción escapular con banda elástica (Remo bajo escapular)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Rotación torácica en decúbito lateral con apertura de libro (Open Book)',
  'Movilidad Articular',
  'Movilidad torácica pura manteniendo la pelvis y columna lumbar bloqueadas a 90 grados de flexión.',
  'Acostado de lado con rodillas y caderas a 90 grados, abrir el brazo superior hacia el lado opuesto acompañando con la cabeza hasta intentar apoyar el omóplato en el suelo.',
  2,
  10,
  NULL,
  1,
  'Columna Dorsal',
  'Músculos rotadores dorsales y pectorales',
  'Movilidad Articular',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido de referencia clínica. Precaución en antecedentes de inestabilidad anterior de hombro.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Rotación torácica en decúbito lateral con apertura de libro (Open Book)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Deslizamiento de brazos contra pared en W a V (Wall Slides escapulares)',
  'Control Motor',
  'Entrenamiento de la báscula externa y ascenso escapular armónico contra superficie vertical.',
  'De espaldas o de frente a la pared, apoyar antebrazos formando una W. Deslizar los brazos hacia arriba en V manteniendo el contacto de muñecas y codos sin arquear la zona lumbar.',
  3,
  10,
  NULL,
  1,
  'Columna Dorsal',
  'Serrato anterior, trapecio inferior y dorsal ancho',
  'Control Motor / Propiocepción',
  'Sin equipamiento',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender si provoca pinzamiento subacromial o compensación cervical con hiperextensión.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Deslizamiento de brazos contra pared en W a V (Wall Slides escapulares)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Separación de banda elástica en plano horizontal (Band Pull-Apart)',
  'Fortalecimiento',
  'Fortalecimiento de la cadena posterior escapular y corrección de hombros adelantados.',
  'Tomar la banda al ancho de hombros con codos casi extendidos frente al pecho. Abrir los brazos horizontalmente tensando la banda hasta tocar el esternón, juntando escápulas al final.',
  3,
  15,
  NULL,
  1,
  'Columna Dorsal',
  'Deltoides posterior, romboides e infraespinoso',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido de referencia que requiere criterio profesional. Evitar hiperextensión cervical compensatoria.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Separación de banda elástica en plano horizontal (Band Pull-Apart)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Movilidad en flexión dorsal en cuadrupedia (Posición del niño)',
  'Movilidad Articular',
  'Descarga axial y elongación del dorsal ancho y musculatura paravertebral torácica.',
  'Desde cuadrupedia, llevar los glúteos hacia los talones extendiendo los brazos al frente sobre la colchoneta. Apoyar la frente y relajar la respiración manteniendo 20 segundos.',
  3,
  5,
  NULL,
  1,
  'Columna Dorsal',
  'Dorsal ancho, fascia toracolumbar y paravertebrales',
  'Movilidad Articular',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado ante patología de rodilla con intolerancia a flexión profunda.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Movilidad en flexión dorsal en cuadrupedia (Posición del niño)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Prono en Y con pulgares al techo para trapecio inferior',
  'Fortalecimiento',
  'Activación aislada de las fibras inferiores del trapecio para estabilización de escápula alada.',
  'Acostado boca abajo con la frente apoyada, colocar brazos en ángulo de 120 grados (forma de Y) con pulgares apuntando hacia arriba. Elevar suavemente los brazos contrayendo la zona baja del omóplato.',
  3,
  10,
  NULL,
  1,
  'Columna Dorsal',
  'Trapecio inferior y paravertebrales dorsales',
  'Fortalecimiento Muscular',
  'Colchoneta',
  'Alto',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender si genera dolor en articulación acromioclavicular.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Prono en Y con pulgares al techo para trapecio inferior');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Expansión costal diafragmática con banda torácica',
  'Reeducación Postural',
  'Reeducación del patrón ventilatorio costo-diafragmático bajo en restricción torácica.',
  'Rodear la base del tórax con una banda elástica suave. Inhalar profundamente expandiendo la caja torácica contra la resistencia lateral de la banda y exhalar de manera prolongada.',
  3,
  8,
  NULL,
  1,
  'Columna Dorsal',
  'Diafragma e intercostales externos',
  'Reeducación Postural',
  'Banda elástica',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Precaución en patología pulmonar restrictiva aguda no estabilizada.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Expansión costal diafragmática con banda torácica');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Cat-Camel segmentario torácico con fijación lumbar',
  'Control Motor',
  'Articulación dorsal vértebra por vértebra minimizando la compensación lumbopélvica.',
  'En cuadrupedia con glúteos algo retrasados hacia talones para fijar la pelvis, alternar flexión y extensión centrada exclusivamente en las vértebras dorsales.',
  3,
  10,
  NULL,
  1,
  'Columna Dorsal',
  'Multífidos torácicos y erectores dorsales',
  'Control Motor / Propiocepción',
  'Colchoneta',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar movimientos bruscos ante espondilitis anquilosante activa.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Cat-Camel segmentario torácico con fijación lumbar');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Rotación interna de hombro con banda elástica a 0 grados de abducción',
  'Fortalecimiento',
  'Fortalecimiento de la cara anterior del manguito rotador manteniendo alineación glenohumeral.',
  'Con codo flexionado a 90 grados y pegado al costado del cuerpo con una toalla enrollada, rotar el antebrazo hacia el abdomen contra la banda elástica sin mover el tronco.',
  3,
  12,
  NULL,
  1,
  'Hombro',
  'Subescapular y pectoral mayor',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido de demostración clínica. Contraindicado en rotura total de subescapular o postoperatorio temprano sin alta médica.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Rotación interna de hombro con banda elástica a 0 grados de abducción');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Elevación en el plano escapular (Scaption) con pulgar arriba',
  'Fortalecimiento',
  'Elevación en plano de 30 grados anterior al plano frontal minimizando el pinzamiento subacromial.',
  'De pie con mancuernas ligeras, elevar los brazos a 30 grados hacia adelante con pulgares orientados hacia arriba hasta un máximo de 80-90 grados. Descender de forma controlada.',
  3,
  10,
  NULL,
  1,
  'Hombro',
  'Supraespinoso, deltoides anterior y serrato anterior',
  'Fortalecimiento Muscular',
  'Mancuernas',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender si provoca arco doloroso subacromial o bursitis reactiva.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Elevación en el plano escapular (Scaption) con pulgar arriba');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Serrato punch en decúbito supino con mancuerna ligera',
  'Fortalecimiento',
  'Protracción pura escapulotorácica para prevención del aleteo escapular e inestabilidad glenohumeral.',
  'Acostado boca arriba, sostener una mancuerna con el brazo extendido perpendicular al suelo. Empujar el puño hacia el techo separando el omóplato de la colchoneta sin flexionar el codo.',
  3,
  12,
  NULL,
  1,
  'Hombro',
  'Serrato anterior',
  'Fortalecimiento Muscular',
  'Mancuernas',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. '
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Serrato punch en decúbito supino con mancuerna ligera');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Auto-elongación de cápsula posterior de hombro (Sleeper Stretch modificado)',
  'Estiramiento',
  'Ganancia de rotación interna glenohumeral y descompresión capsular posterior.',
  'Acostado sobre el hombro afecto con el brazo a 70 grados de elevación y codo flexionado a 90 grados, empujar con la otra mano el antebrazo hacia el suelo con suavidad. Mantener 25 segundos.',
  3,
  3,
  NULL,
  1,
  'Hombro',
  'Cápsula posterior glenohumeral e infraespinoso',
  'Flexibilidad',
  'Colchoneta',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No realizar si existe conflicto subacromial anterosuperior o inestabilidad posterior.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Auto-elongación de cápsula posterior de hombro (Sleeper Stretch modificado)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Isometría submáxima de abducción de hombro contra marco de puerta',
  'Isométrico',
  'Contracción isométrica analgésica para tendinopatías del manguito en fases iniciales.',
  'De pie junto al marco de una puerta con el brazo a un lado del tronco. Presionar el dorso de la muñeca contra el marco sin desplazamiento articular durante 8 segundos al 40% de fuerza.',
  3,
  6,
  NULL,
  1,
  'Hombro',
  'Deltoides medio y supraespinoso',
  'Fortalecimiento Muscular',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No aplicar cargas excesivas que superen el umbral de dolor del paciente.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Isometría submáxima de abducción de hombro contra marco de puerta');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Rotación externa en decúbito lateral con mancuerna ligera',
  'Fortalecimiento',
  'Máxima activación electromiográfica de rotadores externos sin compensación del deltoides anterior.',
  'Acostado de lado sobre el costado sano, colocar una pequeña toalla bajo el codo del brazo afectado flexionado a 90 grados. Rotar el antebrazo hacia arriba contra la gravedad y descender lento.',
  3,
  10,
  NULL,
  1,
  'Hombro',
  'Infraespinoso y redondo menor',
  'Fortalecimiento Muscular',
  'Mancuernas',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender si aparece chasquido anterior doloroso.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Rotación externa en decúbito lateral con mancuerna ligera');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Propiocepción rítmica glenohumeral con balón contra pared',
  'Propiocepción',
  'Estabilización refleja articular ante microperturbaciones mecánicas multidireccionales.',
  'Con el brazo estirado al frente a 90 grados, presionar una pelota pequeña contra la pared y dibujar pequeños círculos u ocho en ambos sentidos manteniendo la estabilidad articular.',
  3,
  10,
  NULL,
  1,
  'Hombro',
  'Co-contracción de manguito rotador y deltoides',
  'Control Motor / Propiocepción',
  'Sin equipamiento',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado en luxación recidivante aguda no estabilizada.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Propiocepción rítmica glenohumeral con balón contra pared');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Flexión anterior asistida de hombro con bastón',
  'Movilidad Articular',
  'Ganancia pasiva y autoasistida de flexión glenohumeral post-cirugía o en capsulitis adhesiva.',
  'De pie o acostado boca arriba, tomar un bastón con ambas manos. Utilizar el brazo sano para empujar el brazo afecto hacia arriba en flexión hasta el límite de confort sin dolor punzante.',
  2,
  12,
  NULL,
  1,
  'Hombro',
  'Deltoides anterior y coracobraquial',
  'Movilidad Articular',
  'Bastón / Pica',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No superar los grados autorizados en protocolos postquirúrgicos tempranos.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Flexión anterior asistida de hombro con bastón');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Extensión isométrica posterior de hombro contra pared',
  'Isométrico',
  'Coaptación de la cabeza humeral en dirección posteroinferior.',
  'De pie con la espalda hacia una pared, empujar el codo ligeramente flexionado hacia atrás contra la pared manteniendo el pecho abierto. Sostener 6 segundos de manera constante.',
  3,
  8,
  NULL,
  1,
  'Hombro',
  'Dorsal ancho, redondo mayor y deltoides posterior',
  'Fortalecimiento Muscular',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar ante capsulitis posterior aguda dolorosa.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Extensión isométrica posterior de hombro contra pared');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Ejercicio de W a Y en decúbito prono sobre fitball',
  'Control Motor',
  'Control cinético de la cintura escapular con demanda de estabilidad central sobre balón.',
  'Con el pecho apoyado sobre un fitball y pies en el suelo, comenzar con brazos en forma de W juntando escápulas y luego extender los brazos a forma de Y manteniendo la alineación cervical.',
  3,
  8,
  NULL,
  1,
  'Hombro',
  'Trapecio medio e inferior, deltoides posterior',
  'Control Motor / Propiocepción',
  'Fitball',
  'Alto',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido clínico que requiere supervisión profesional. Precaución en patología lumbar inestable.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Ejercicio de W a Y en decúbito prono sobre fitball');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Circunducción en plano escapular con apoyo monopodal',
  'Propiocepción',
  'Integración sensorimotora cruzada de miembro superior con equilibrio estático de pelvis.',
  'Parado sobre la pierna contralateral, realizar círculos lentos y precisos en el plano escapular con el brazo a 45 grados de abducción, manteniendo pelvis neutra y control visual.',
  3,
  8,
  NULL,
  1,
  'Hombro',
  'Fijadores escapulares y core',
  'Control Motor / Propiocepción',
  'Sin equipamiento',
  'Alto',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No aplicar si existe riesgo de caídas sin asistencia.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Circunducción en plano escapular con apoyo monopodal');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Deslizamiento en pared con foam roller para serrato anterior',
  'Rehabilitación Funcional',
  'Dinámica de rotación superior escapular con resistencia guiada contra pared.',
  'Colocar antebrazos sobre un foam roller contra la pared. Rodar hacia arriba empujando con los codos y protraer activamente los omóplatos en el punto más alto.',
  3,
  10,
  NULL,
  1,
  'Hombro',
  'Serrato anterior y dorsal ancho',
  'Fortalecimiento Muscular',
  'Rollo de espuma (Foam roller)',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido de referencia clínica. Suspender si existe bursitis subdeltoidea reactiva.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Deslizamiento en pared con foam roller para serrato anterior');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Extensión excéntrica de muñeca con peso ligero (Protocolo Tyler)',
  'Fortalecimiento',
  'Remodelación tendinosa excéntrica en tendinopatía de codo de tenista (epicondilalgia lateral).',
  'Con antebrazo apoyado en mesa y mano fuera del borde con la palma abajo, asistir la extensión de muñeca con la otra mano y descender el peso en fase excéntrica lenta (4 segundos).',
  3,
  15,
  NULL,
  1,
  'Codo / Muñeca / Mano',
  'Extensor radial corto del carpo y extensores de muñeca',
  'Fortalecimiento Muscular',
  'Mancuernas',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No realizar en fase inflamatoria aguda hiperálgica.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Extensión excéntrica de muñeca con peso ligero (Protocolo Tyler)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Flexión excéntrica de muñeca para epitroclealgia',
  'Fortalecimiento',
  'Regeneración tendinosa excéntrica de la masa flexopronadora medial de codo.',
  'Antebrazo apoyado con palma hacia arriba. Asistir la subida de la mancuerna con la mano libre y resistir la bajada de forma muy lenta y suave hasta extensión completa.',
  3,
  15,
  NULL,
  1,
  'Codo / Muñeca / Mano',
  'Flexores de muñeca y pronador redondo',
  'Fortalecimiento Muscular',
  'Mancuernas',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender ante neuropatía por compresión del nervio cubital en canal epitrocleoolecraniano.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Flexión excéntrica de muñeca para epitroclealgia');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Pronosupinación activa de antebrazo con peso excéntrico',
  'Fortalecimiento',
  'Reeducación del torque pronosupinador en rango funcional y fortalecimiento distal.',
  'Sujetar una mancuerna agarrada por un extremo o un bastón lastrado. Girar lenta y controladamente el antebrazo de palma arriba a palma abajo sin separar el codo del costado.',
  3,
  10,
  NULL,
  1,
  'Codo / Muñeca / Mano',
  'Supinador corto, bíceps braquial, pronador redondo y cuadrado',
  'Movilidad Articular',
  'Mancuernas',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado en inestabilidad radiocubital distal o rotura de fibrocartílago triangular.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Pronosupinación activa de antebrazo con peso excéntrico');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Deslizamiento neural del nervio mediano (Neurodinamia)',
  'Movilidad Articular',
  'Restauración del deslizamiento neurofisiológico en síndrome del túnel carpiano.',
  'Con brazo en abducción a 90 grados, extender muñeca y dedos mientras se inclina la cabeza hacia el mismo lado. Luego flexionar muñeca al inclinar la cabeza al lado opuesto sin reproducir dolor eléctrico.',
  3,
  8,
  NULL,
  1,
  'Codo / Muñeca / Mano',
  'Tronco neural mediano y plexo braquial',
  'Movilidad Articular',
  'Sin equipamiento',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido clínico de demostración. No provocar disestesias continuas ni dolor neuropático punzante.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Deslizamiento neural del nervio mediano (Neurodinamia)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Flexo-extensión isométrica de codo a 90 grados',
  'Isométrico',
  'Mantenimiento de la fuerza muscular en codo postinmovilización o dolor agudo articular.',
  'Con el codo en 90 grados, empujar hacia arriba contra el envés de una mesa para flexión, y hacia abajo para extensión. Sostener 6 segundos sin mover la articulación.',
  3,
  8,
  NULL,
  1,
  'Codo / Muñeca / Mano',
  'Bíceps braquial, braquial anterior y tríceps',
  'Fortalecimiento Muscular',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar cargas dolorosas en bursitis olecraniana inflamada.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Flexo-extensión isométrica de codo a 90 grados');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Desviaciones radiales y cubitales con banda elástica',
  'Fortalecimiento',
  'Estabilidad mediocarpiana y dinamismo en planos laterales de muñeca.',
  'Antebrazo apoyado en canto neutro con pulgar hacia arriba. Mover la mano hacia arriba (desviación radial) y hacia abajo (desviación cubital) contra la resistencia de una banda elástica.',
  3,
  12,
  NULL,
  1,
  'Codo / Muñeca / Mano',
  'Flexor y extensor cubital y radial del carpo',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado en tenosinovitis de De Quervain aguda severa.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Desviaciones radiales y cubitales con banda elástica');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Prensión manual progresiva con pelota de rehabilitación',
  'Fortalecimiento',
  'Recuperación de la fuerza de prensión palmar global y función de pinza manual.',
  'Apretar rítmicamente una pelota antiestrés o masa terapéutica sosteniendo la presión máxima 3 segundos y abriendo los dedos completamente al relajar.',
  3,
  12,
  NULL,
  1,
  'Codo / Muñeca / Mano',
  'Flexores profundos y superficiales de los dedos, lumbricales',
  'Fortalecimiento Muscular',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido de referencia clínica. Precaución en artritis reumatoide en fase de brote inflamatorio agudo.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Prensión manual progresiva con pelota de rehabilitación');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Oposición de pulgar y pinza fina secuencial',
  'Control Motor',
  'Reeducación de la motricidad fina y prensión digital para destreza de la mano.',
  'Tocar la yema de cada dedo con la yema del pulgar de manera secuencial, aplicando ligera presión. Luego separar los dedos extendiendo la mano completamente.',
  3,
  10,
  NULL,
  1,
  'Codo / Muñeca / Mano',
  'Oponente del pulgar, abductor corto y aductor del pulgar',
  'Control Motor / Propiocepción',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Adaptar en rizartrosis trapeciometacarpiana dolorosa.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Oposición de pulgar y pinza fina secuencial');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Estiramiento pasivo de flexores y pronadores de muñeca',
  'Estiramiento',
  'Alivio de sobrecarga muscular en antebrazo anterior y síndrome de compresión carpiana.',
  'Extender el brazo al frente con el codo extendido y los dedos hacia arriba. Con la otra mano traccionar suavemente de la palma hacia atrás manteniendo el codo estirado 25 segundos.',
  3,
  3,
  NULL,
  1,
  'Codo / Muñeca / Mano',
  'Flexores comunes de los dedos y palmar mayor',
  'Flexibilidad',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender si provoca acorchamiento inmediato en territorio del nervio mediano.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Estiramiento pasivo de flexores y pronadores de muñeca');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Bird-Dog contralateral con estabilización lumbopélvica',
  'Control Motor',
  'Disociación de extremidades cruzadas minimizando el movimiento rotacional de columna lumbar.',
  'En cuadrupedia con columna neutra, extender simultáneamente el brazo derecho y la pierna izquierda hasta la horizontal sin rotar la pelvis ni arquear la espalda baja. Sostener 3 segundos y cambiar.',
  3,
  10,
  NULL,
  1,
  'Core / Tronco',
  'Multífidos, glúteo mayor y deltoides posterior',
  'Estabilidad del Core',
  'Colchoneta',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar ante inestabilidad facetaria aguda no tolerada.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Bird-Dog contralateral con estabilización lumbopélvica');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Dead-Bug con disociación de extremidades',
  'Control Motor',
  'Preservación de la lordosis fisiológica mediante activación del core anterior ante extensión de palanca.',
  'Acostado boca arriba con caderas y rodillas a 90 grados y brazos al techo. Descender brazo derecho hacia atrás y pierna izquierda hacia adelante rozando el suelo sin despegar la zona lumbar.',
  3,
  10,
  NULL,
  1,
  'Core / Tronco',
  'Transverso del abdomen, recto abdominal y flexores de cadera',
  'Estabilidad del Core',
  'Colchoneta',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido de referencia clínica. Suspender si la zona lumbar se arquea descontroladamente provocando dolor.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Dead-Bug con disociación de extremidades');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Plancha abdominal frontal modificada apoyando rodillas',
  'Isométrico',
  'Introducción segura al trabajo isométrico de pared anterior abdominal sin sobrecarga de psoas.',
  'Apoyar antebrazos y rodillas manteniendo una línea recta entre hombros, cadera y rodillas. Contraer abdomen hacia adentro y glúteos, sosteniendo 20 segundos sin colapsar la pelvis.',
  3,
  6,
  NULL,
  1,
  'Core / Tronco',
  'Transverso del abdomen, oblicuos y serrato anterior',
  'Estabilidad del Core',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Precaución en diástasis de rectos sin supervisión o hernia abdominal.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Plancha abdominal frontal modificada apoyando rodillas');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Plancha lateral sobre rodillas para cuadrado lumbar',
  'Isométrico',
  'Fortalecimiento de la cadena lateral del tronco fundamental para estabilización coronal de raquis.',
  'De lado con antebrazo apoyado bajo el hombro y rodillas flexionadas a 90 grados. Elevar la pelvis formando una línea recta desde la cabeza hasta las rodillas. Sostener 15-20 segundos.',
  3,
  5,
  NULL,
  1,
  'Core / Tronco',
  'Cuadrado lumbar, oblicuo interno y glúteo medio',
  'Estabilidad del Core',
  'Colchoneta',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado en dolor agudo de hombro de apoyo o escoliosis descompensada severa.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Plancha lateral sobre rodillas para cuadrado lumbar');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Press Pallof con banda elástica antirotación',
  'Fortalecimiento',
  'Resistencia al momento torsor externo para protección del disco intervertebral lumbar.',
  'De pie en postura atlética perpendicular al anclaje de la banda sujeta al pecho. Extender los brazos al frente resistiendo la fuerza elástica que intenta girar el torso. Sostener 3 segundos.',
  3,
  10,
  NULL,
  1,
  'Core / Tronco',
  'Oblicuo externo e interno, transverso y glúteos',
  'Estabilidad del Core',
  'Banda elástica',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar torsiones lumbares compensatorias.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Press Pallof con banda elástica antirotación');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Báscula pélvica de anteversión y retroversión en decúbito supino (Pelvic Tilt)',
  'Control Motor',
  'Conciencia motriz del movimiento sagital de pelvis y disociación de la charnela lumbosacra.',
  'Acostado boca arriba con rodillas flexionadas. Aplanar activamente el arco lumbar contra la colchoneta mediante retroversión pélvica y luego aumentar suavemente el arco sin despegar glúteos.',
  3,
  12,
  NULL,
  1,
  'Columna Lumbar',
  'Abdominales bajos, suelo pélvico y glúteos',
  'Control Motor / Propiocepción',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Sin contraindicaciones mecánicas absolutas en dolor leve.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Báscula pélvica de anteversión y retroversión en decúbito supino (Pelvic Tilt)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Curl-Up modificado de McGill con soporte lumbar manual',
  'Fortalecimiento',
  'Activación del recto abdominal sin flexión lumbar ni compresión discal.',
  'Una pierna flexionada y la otra extendida, manos debajo del arco lumbar para mantener la lordosis neutra. Despegar únicamente la cabeza y parte alta de los hombros sin doblar la columna lumbar.',
  3,
  8,
  NULL,
  1,
  'Core / Tronco',
  'Recto anterior del abdomen con columna lumbar neutra',
  'Estabilidad del Core',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender ante cervicalgia con incapacidad de sostén cefálico.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Curl-Up modificado de McGill con soporte lumbar manual');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Extensión lumbar pasiva en decúbito prono (Protocolo McKenzie)',
  'Movilidad Articular',
  'Centralización discal mediante extensión pasiva en síndrome de desajuste posterior lumbar.',
  'Acostado boca abajo, colocar las manos bajo los hombros y extender los codos empujando el torso hacia arriba manteniendo glúteos y pelvis totalmente relajados contra el suelo.',
  3,
  10,
  NULL,
  1,
  'Columna Lumbar',
  'Paravertebrales lumbares y anillo discal posterior',
  'Movilidad Articular',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado de manera absoluta si periférica el dolor hacia miembros inferiores o en espondilolistesis ístmica sintomática.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Extensión lumbar pasiva en decúbito prono (Protocolo McKenzie)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Rodillas al pecho alternadas en decúbito supino',
  'Movilidad Articular',
  'Apertura de agujeros de conjunción y estiramiento de paravertebrales en estenosis de canal.',
  'Acostado boca arriba, abrazar una rodilla llevándola suavemente hacia el tórax mientras la otra pierna permanece flexionada. Sostener 5 segundos y alternar con suavidad.',
  2,
  10,
  NULL,
  1,
  'Columna Lumbar',
  'Extensores lumbares y glúteo mayor',
  'Movilidad Articular',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar en hernia discal extruida aguda posterior intolerante a flexión.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Rodillas al pecho alternadas en decúbito supino');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Elevación de pelvis sobre fitball con rodillas flexionadas',
  'Rehabilitación Funcional',
  'Fortalecimiento de la cadena posterior con inestabilidad distal y demanda de coactivación lumbopélvica.',
  'Acostado boca arriba con los talones apoyados sobre la pelota suiza. Elevar la pelvis hacia una línea recta con el tronco y rodar la pelota hacia los glúteos flexionando rodillas con control.',
  3,
  10,
  NULL,
  1,
  'Core / Tronco',
  'Isquiosurales, glúteos y erectores de la espina',
  'Fortalecimiento Muscular',
  'Fitball',
  'Alto',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. '
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Elevación de pelvis sobre fitball con rodillas flexionadas');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Rotación lumbar controlada con rodillas juntas en colchoneta',
  'Movilidad Articular',
  'Relajación de la musculatura profunda paravertebral y movilidad rotatoria suave.',
  'Acostado boca arriba con brazos en cruz y rodillas juntas flexionadas a 90 grados. Dejar caer ambas rodillas hacia un lado manteniendo hombros apoyados, regresar al centro y rotar al otro lado.',
  2,
  10,
  NULL,
  1,
  'Columna Lumbar',
  'Rotadores de tronco y fascia toracolumbar',
  'Movilidad Articular',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No forzar ante ciatalgia aguda radicular con signo de Lasègue positivo.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Rotación lumbar controlada con rodillas juntas en colchoneta');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Caminata del granjero unilateral (Suitcase Carry)',
  'Rehabilitación Funcional',
  'Estabilización de la pelvis en el plano frontal durante el ciclo completo de la marcha.',
  'Sostener una mancuerna o pesa en una sola mano a un costado del cuerpo. Caminar 15 metros manteniendo los hombros perfectamente nivelados sin inclinarse hacia el lado del peso.',
  3,
  8,
  NULL,
  1,
  'Core / Tronco',
  'Cuadrado lumbar contralateral, oblicuos y glúteo medio',
  'Estabilidad del Core',
  'Mancuernas',
  'Alto',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No utilizar en dolor facetario agudo activo o claudicación radicular.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Caminata del granjero unilateral (Suitcase Carry)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Puente bipodal con empuje de aductores sobre pelota blanda',
  'Fortalecimiento',
  'Coactivación de la sínfisis del pubis y estabilizadores pélvicos profundos.',
  'Acostado boca arriba con una pelota blanda o cojín entre las rodillas. Apretar la pelota moderadamente mientras se eleva la pelvis del suelo contrayendo glúteos.',
  3,
  12,
  NULL,
  1,
  'Pelvis / Cadera',
  'Glúteo mayor, aductores y suelo pélvico',
  'Estabilidad y Balance',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Precaución en pubalgia aguda o tendinopatía de aductores hiperálgica.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Puente bipodal con empuje de aductores sobre pelota blanda');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Clamshell (Almeja) con banda elástica circular sobre rodillas',
  'Fortalecimiento',
  'Aislamiento del glúteo medio posterior para control del valgo dinámico de rodilla.',
  'Acostado de lado con rodillas a 45 grados y pies juntos. Separar la rodilla superior hacia el techo manteniendo los talones en contacto sin rotar la pelvis hacia atrás.',
  3,
  12,
  NULL,
  1,
  'Pelvis / Cadera',
  'Glúteo medio y rotadores externos de cadera',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Precaución en bursitis trocantérea aguda dolorosa.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Clamshell (Almeja) con banda elástica circular sobre rodillas');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Abducción de cadera en decúbito lateral con pierna extendida',
  'Fortalecimiento',
  'Trabajo antigravitatorio en abducción pura sin flexión accesoria de cadera.',
  'De lado, extender la pierna superior alineada ligeramente por detrás del tronco con el pie en rotación neutra. Elevar la pierna 30 grados sin balancear el torso y descender lento.',
  3,
  12,
  NULL,
  1,
  'Pelvis / Cadera',
  'Glúteo medio y tensor de la fascia lata',
  'Fortalecimiento Muscular',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar balanceo lumbopélvico por fatiga del glúteo.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Abducción de cadera en decúbito lateral con pierna extendida');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Monster Walks con banda elástica en tobillos',
  'Rehabilitación Funcional',
  'Fortalecimiento dinámico en patrón de marcha en semisentadilla para estabilidad frontal de pelvis.',
  'Colocar la banda alrededor de los tobillos. Adoptar postura de media sentadilla y dar pasos laterales o en diagonal manteniendo la tensión elástica y rodillas alineadas con los pies.',
  3,
  10,
  NULL,
  1,
  'Pelvis / Cadera',
  'Glúteo medio, glúteo menor y cuádriceps',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido de referencia clínica. Suspender si provoca colapso medial de rodilla descontrolado.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Monster Walks con banda elástica en tobillos');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Bisagra de cadera guiada con pica (Hip Hinge postural)',
  'Control Motor',
  'Aprendizaje del patrón motor disociativo coxofemoral protegiendo la columna lumbar.',
  'Sostener un bastón a lo largo de la espalda tocando cabeza, zona dorsal y sacro. Flexionar caderas llevando glúteos hacia atrás con mínima flexión de rodillas manteniendo los 3 puntos de contacto.',
  3,
  10,
  NULL,
  1,
  'Pelvis / Cadera',
  'Isquiotibiales, glúteo mayor y erectores espinales',
  'Reeducación Postural',
  'Bastón / Pica',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Ajustar rango si existe acortamiento severo de isquiotibiales.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Bisagra de cadera guiada con pica (Hip Hinge postural)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Empuje de cadera (Hip Thrust) bipodal sobre banco',
  'Fortalecimiento',
  'Sobrecarga biomecánicamente óptima en extensión de cadera con menor estrés de cizalla lumbar.',
  'Apoyar la parte media de la espalda en el borde de un banco firme con pies a la anchura de caderas. Bajar la pelvis y extender caderas hasta formar un puente horizontal bloqueando con glúteos.',
  3,
  10,
  NULL,
  1,
  'Pelvis / Cadera',
  'Glúteo mayor',
  'Fortalecimiento Muscular',
  'Silla / Escalón',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar hiperextensión lumbar al finalizar el movimiento.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Empuje de cadera (Hip Thrust) bipodal sobre banco');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Estiramiento del psoas-ilíaco en posición de caballero (Lunge estático)',
  'Estiramiento',
  'Alivio de retracciones anteriores de cadera causantes de hiperlordosis lumbar por sedentarismo.',
  'Rodilla retrasada apoyada en colchoneta y pie adelantado a 90 grados. Aplicar una retroversión pélvica activa apretando el glúteo y desplazar la pelvis suavemente al frente sin arquear la zona lumbar.',
  3,
  3,
  NULL,
  1,
  'Pelvis / Cadera',
  'Psoas mayor e ilíaco',
  'Flexibilidad',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado en bursitis del psoas activa o desgarro agudo de flexores.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Estiramiento del psoas-ilíaco en posición de caballero (Lunge estático)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Rotación externa e interna activa de cadera en sedestación',
  'Movilidad Articular',
  'Mantenimiento del rango articular de rotación en articulación coxofemoral en plano transversal.',
  'Sentado al borde de una silla con rodillas a 90 grados. Llevar el pie hacia adentro para evaluar rotación externa de cadera y luego hacia afuera para rotación interna sin inclinar el torso.',
  3,
  10,
  NULL,
  1,
  'Pelvis / Cadera',
  'Obturadores, piramidal, géminos y glúteo menor',
  'Movilidad Articular',
  'Silla / Escalón',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No forzar en choque femoroacetabular conocido con maniobra FADIR positiva.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Rotación externa e interna activa de cadera en sedestación');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Estiramiento profundo de piramidal en figura 4 en supino',
  'Estiramiento',
  'Descompresión del espacio ciático infrapiriforme en pseudociáticas o dolor glúteo profundo.',
  'Acostado boca arriba, cruzar el tobillo de la pierna a estirar sobre la rodilla contraria. Sujetar el muslo de la pierna de apoyo y traccionarlo hacia el pecho manteniendo la cabeza apoyada.',
  3,
  3,
  NULL,
  1,
  'Pelvis / Cadera',
  'Músculo piriforme / piramidal de la pelvis',
  'Flexibilidad',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Precaución en prótesis total de cadera reciente (riesgo de luxación posterior).'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Estiramiento profundo de piramidal en figura 4 en supino');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Puente bipodal con abducción isométrica en banda elástica',
  'Fortalecimiento',
  'Trabajo combinado de extensión coxofemoral y estabilización abductora.',
  'Con banda sobre rodillas, elevar la pelvis separando rodillas contra la tensión elástica. Sostener 2 segundos en contracción máxima glútea y descender despacio.',
  3,
  12,
  NULL,
  1,
  'Pelvis / Cadera',
  'Glúteo mayor y glúteo medio simultáneo',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido de referencia demostrativo. Evitar ante calambres frecuentes en isquiotibiales (revisar posición de pies).'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Puente bipodal con abducción isométrica en banda elástica');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Patada de glúteo en cuadrupedia con rodilla flexionada',
  'Fortalecimiento',
  'Extensión coxofemoral pura inhibiendo la acción sustitutiva de los isquiosurales.',
  'En cuadrupedia con espalda plana, elevar una pierna manteniendo la rodilla a 90 grados y la planta del pie mirando hacia el techo hasta alinear el muslo con el tronco sin arquear la espalda.',
  3,
  12,
  NULL,
  1,
  'Pelvis / Cadera',
  'Glúteo mayor aislado',
  'Fortalecimiento Muscular',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No arquear la columna lumbar al subir la pierna.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Patada de glúteo en cuadrupedia con rodilla flexionada');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Deslizamiento lateral de cadera en bipedestación (Side Lunge asistido)',
  'Movilidad Articular',
  'Ganancia excéntrica y movilidad en plano frontal de cadera.',
  'De pie, apoyar un pie sobre una toalla en suelo liso. Deslizar la pierna lateralmente mientras se flexiona la cadera y rodilla de apoyo, manteniendo la espalda recta.',
  3,
  8,
  NULL,
  1,
  'Pelvis / Cadera',
  'Aductores y glúteo mayor',
  'Movilidad Articular',
  'Sin equipamiento',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Precaución en lesiones de menisco medial o ligamento colateral medial.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Deslizamiento lateral de cadera en bipedestación (Side Lunge asistido)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Estabilidad pélvica de Trendelenburg en escalón',
  'Control Motor',
  'Control excéntrico y concéntrico del glúteo medio en monopodal frente a la gravedad.',
  'Parado sobre un escalón con un pie al aire. Dejar caer suavemente la pelvis del lado libre sin doblar la rodilla de apoyo y luego elevar la cadera mediante contracción del glúteo de apoyo.',
  3,
  10,
  NULL,
  1,
  'Pelvis / Cadera',
  'Glúteo medio en cadena cinética cerrada',
  'Control Motor / Propiocepción',
  'Silla / Escalón',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No realizar sin apoyo manual si hay déficit grave del equilibrio.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Estabilidad pélvica de Trendelenburg en escalón');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Extensión terminal de rodilla con banda elástica (TKE)',
  'Fortalecimiento',
  'Activación selectiva de los últimos 20 grados de extensión sin sobrecarga patelofemoral.',
  'De pie con una banda anclada frente a la rodilla y pasando por el hueco poplíteo. Partir con la rodilla ligeramente flexionada y extender completamente empujando hacia atrás contra la banda.',
  3,
  15,
  NULL,
  1,
  'Rodilla',
  'Vasto medial oblicuo y cuádriceps global',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. '
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Extensión terminal de rodilla con banda elástica (TKE)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Sentadilla goblet asistida a silla',
  'Rehabilitación Funcional',
  'Readaptación funcional del patrón de sentadilla limitando la profundidad articular con seguridad.',
  'De pie frente a una silla con pies al ancho de hombros. Bajar caderas controladamente hacia la silla rozando el asiento y volver a subir impulsando desde los talones.',
  3,
  10,
  NULL,
  1,
  'Rodilla',
  'Cuádriceps, glúteo mayor y core',
  'Fortalecimiento Muscular',
  'Silla / Escalón',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido de referencia. Suspender si produce dolor retropatelar agudo o derrame articular.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Sentadilla goblet asistida a silla');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Step-up bajo con descenso excéntrico controlado',
  'Rehabilitación Funcional',
  'Trabajo excéntrico clave en tendinopatía rotuliana y control del valgo en bajada de escaleras.',
  'Sobre un escalón bajo de 15 cm, bajar lentamente el pie opuesto hacia el suelo en 4 segundos rozando el talón sin transferir peso y volver a subir con la pierna de apoyo.',
  3,
  8,
  NULL,
  1,
  'Rodilla',
  'Cuádriceps excéntrico y glúteo medio',
  'Control Motor / Propiocepción',
  'Silla / Escalón',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado en tendinitis patelar aguda hiperálgica no tolerada.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Step-up bajo con descenso excéntrico controlado');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Deslizamiento de talón en decúbito supino para flexión de rodilla (Heel Slide)',
  'Movilidad Articular',
  'Recuperación de la flexión articular activa asistida en posquirúrgico de LCA o prótesis.',
  'Acostado boca arriba con toalla bajo el talón. Deslizar el talón hacia los glúteos doblando la rodilla hasta el límite confortable sin rebote y regresar suavemente a extensión.',
  3,
  12,
  NULL,
  1,
  'Rodilla',
  'Isquiotibiales y cápsula articular de rodilla',
  'Movilidad Articular',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Respetar límites angulares prescritos por el cirujano tratante.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Deslizamiento de talón en decúbito supino para flexión de rodilla (Heel Slide)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Extensión isométrica de cuádriceps sobre rollo poplíteo',
  'Isométrico',
  'Inhibición artrogénica del cuádriceps e inicio precoz de la coactivación articular.',
  'Acostado con un rollo de toalla o foam bajo el hueco poplíteo. Empujar la rodilla hacia abajo aplastando el rollo mientras se despega el talón del suelo activando el muslo por 6 segundos.',
  3,
  10,
  NULL,
  1,
  'Rodilla',
  'Cuádriceps femoral (recto anterior y vastos)',
  'Fortalecimiento Muscular',
  'Rollo de espuma (Foam roller)',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. '
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Extensión isométrica de cuádriceps sobre rollo poplíteo');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Curl de isquiotibiales en decúbito prono con tobillera',
  'Fortalecimiento',
  'Fortalecimiento analítico concéntrico-excéntrico de la musculatura flexora de rodilla.',
  'Acostado boca abajo con peso liviano en el tobillo. Flexionar la rodilla acercando el talón al glúteo hasta los 90 grados y descender en 3 segundos sin despegar la pelvis de la camilla.',
  3,
  12,
  NULL,
  1,
  'Rodilla',
  'Bíceps femoral, semitendinoso y semimembranoso',
  'Fortalecimiento Muscular',
  'Tobilleras',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido de referencia clínica. Contraindicado en rotura miofascial aguda de isquiotibiales.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Curl de isquiotibiales en decúbito prono con tobillera');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Isometría de cuádriceps en 60 grados con apoyo en fitball contra pared',
  'Isométrico',
  'Contracción isométrica en ángulo protector de presión fémoro-rotuliana.',
  'Apoyar la espalda en un fitball contra la pared. Descender a una sentadilla moderada a 60 grados de flexión de rodilla y sostener la posición durante 20-25 segundos respirando normalmente.',
  3,
  6,
  NULL,
  1,
  'Rodilla',
  'Cuádriceps y estabilizadores pélvicos',
  'Fortalecimiento Muscular',
  'Fitball',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender ante condromalacia rotuliana grado IV dolorosa en dicho ángulo.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Isometría de cuádriceps en 60 grados con apoyo en fitball contra pared');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Puente nórdico modificado con asistencia elástica',
  'Fortalecimiento',
  'Prevención de desgarros isquiosurales mediante elongación miotendinosa excéntrica con asistencia elástica.',
  'De rodillas con tobillos fijados y una banda sujeta arriba ayudando al pecho. Dejar caer el cuerpo hacia adelante en bloque desde las rodillas frenando con los isquiosurales.',
  3,
  6,
  NULL,
  1,
  'Rodilla',
  'Isquiotibiales excéntricos',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Alto',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado en tendinopatía de inserción proximal aguda.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Puente nórdico modificado con asistencia elástica');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Equilibrio monopodal dinámico en estrella (Y-Balance modificado)',
  'Propiocepción',
  'Control neuromuscular dinámico en alcances multidireccionales con pierna suspendida.',
  'Apoyado en una sola pierna con rodilla semiflexionada, alcanzar con la punta del pie contrario la máxima distancia anterior, posteromedial y posterolateral sin perder el equilibrio.',
  3,
  6,
  NULL,
  1,
  'Rodilla',
  'Cuádriceps, glúteo medio y estabilizadores de tobillo',
  'Control Motor / Propiocepción',
  'Sin equipamiento',
  'Alto',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No realizar en fase de inestabilidad ligamentaria no resuelta.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Equilibrio monopodal dinámico en estrella (Y-Balance modificado)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Estiramiento pasivo de cuádriceps en decúbito prono con cincha',
  'Estiramiento',
  'Elongación selectiva del componente biarticular del aparato extensor de rodilla.',
  'Acostado boca abajo, pasar una correa o toalla por el empeine. Traccionar con suavidad llevando el talón hacia el glúteo manteniendo la cadera pegada a la colchoneta por 25 segundos.',
  3,
  3,
  NULL,
  1,
  'Rodilla',
  'Recto femoral y psoas ilíaco',
  'Flexibilidad',
  'Colchoneta',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar flexión excesiva en lesiones del cuerno posterior de menisco.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Estiramiento pasivo de cuádriceps en decúbito prono con cincha');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Sentadilla búlgara con apoyo en banco bajo',
  'Fortalecimiento',
  'Fortalecimiento asimétrico en cadena cinética cerrada con alta demanda propioceptiva.',
  'Un pie apoyado atrás sobre un escalón bajo, el otro adelantado. Descender verticalmente flexionando ambas rodillas cuidando que la rodilla adelantada no colapse hacia medial.',
  3,
  8,
  NULL,
  1,
  'Rodilla',
  'Cuádriceps, glúteo mayor y estabilizadores pélvicos',
  'Fortalecimiento Muscular',
  'Silla / Escalón',
  'Alto',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No prescribir en dolor patelofemoral agudo o falta de estabilidad básica.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Sentadilla búlgara con apoyo en banco bajo');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Flexo-extensión de rodilla en cadena abierta con tobillera en silla',
  'Fortalecimiento',
  'Aislamiento concéntrico y excéntrico del cuádriceps en arco de movimiento de 90 a 30 grados.',
  'Sentado erguido en silla con tobillera lastrada. Extender la pierna hacia el frente hasta dejar la rodilla casi recta, sostener 1 segundo arriba y descender lento en 3 segundos.',
  3,
  12,
  NULL,
  1,
  'Rodilla',
  'Cuádriceps en rango medio-final',
  'Fortalecimiento Muscular',
  'Tobilleras',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Limitar últimos 30 grados de extensión ante patología femororrotuliana reactiva.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Flexo-extensión de rodilla en cadena abierta con tobillera en silla');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Elevación excéntrica de talones en escalón (Protocolo Alfredson)',
  'Fortalecimiento',
  'Estimulación del colágeno tendinoso mediante fase excéntrica lenta con carga corporal.',
  'Apoyar los antepiés en el borde de un escalón. Subir con ambas piernas a puntillas y descender lentamente con una sola pierna llevando el talón por debajo del escalón en 4 segundos.',
  3,
  15,
  NULL,
  1,
  'Tobillo / Pie',
  'Gemelos (gastrocnemios) y sóleo',
  'Fortalecimiento Muscular',
  'Silla / Escalón',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado en rotura aguda o parcial severa de tendón calcáneo sin consolidar.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Elevación excéntrica de talones en escalón (Protocolo Alfredson)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Dorsiflexión de tobillo resistida con banda elástica',
  'Fortalecimiento',
  'Prevención de pie caído y equilibrio en fase de balanceo de la marcha humana.',
  'Sentado en el suelo con piernas extendidas y una banda sujeta enfrente fijada al empeine. Llevar los dedos y el pie hacia arriba y hacia la espinilla contra la banda, sostener y volver despacio.',
  3,
  15,
  NULL,
  1,
  'Tobillo / Pie',
  'Tibial anterior y extensores de dedos',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender en síndrome compartimental anterior agudo o periostitis hiperálgica.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Dorsiflexión de tobillo resistida con banda elástica');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Eversión de tobillo con banda elástica para peroneos',
  'Fortalecimiento',
  'Fortalecimiento de los principales estabilizadores dinámicos antiesguince por inversión.',
  'Sentado con piernas estiradas, cruzar una banda en el antepié traccionando hacia medial. Llevar el borde exterior del pie hacia afuera y arriba contrayendo la cara lateral de la pierna.',
  3,
  12,
  NULL,
  1,
  'Tobillo / Pie',
  'Peroneo lateral largo y corto',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contenido de referencia clínica. Precaución en fractura de base de quinto metatarsiano o luxación tendinosa peroneal.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Eversión de tobillo con banda elástica para peroneos');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Inversión de tobillo con banda elástica para tibial posterior',
  'Fortalecimiento',
  'Sostén del arco longitudinal medial del pie y control de pronación patológica.',
  'Con la banda traccionando el antepié hacia el exterior, llevar la planta del pie hacia adentro y arriba contrayendo el músculo medial de la pantorrilla sin mover la rodilla.',
  3,
  12,
  NULL,
  1,
  'Tobillo / Pie',
  'Tibial posterior y flexores profundos',
  'Fortalecimiento Muscular',
  'Banda elástica',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado en tendinopatía de tibial posterior en fase III con deformidad rígida.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Inversión de tobillo con banda elástica para tibial posterior');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Ejercicio de pie corto (Short Foot / Trípode plantar)',
  'Control Motor',
  'Activación del domo plantar y apoyo trípode (talón, primer y quinto metatarsiano) sin enroscar los dedos.',
  'Descalzo en bipedestación o sentado, acercar la base del primer dedo hacia el talón elevando el arco medial del pie sin flexionar los dedos en garra. Sostener 5 segundos.',
  3,
  10,
  NULL,
  1,
  'Tobillo / Pie',
  'Musculatura intrínseca plantar (abductor del hallux, flexor corto)',
  'Control Motor / Propiocepción',
  'Sin equipamiento',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. '
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Ejercicio de pie corto (Short Foot / Trípode plantar)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Propiocepción monopodal sobre superficie inestable (BOSU o disco)',
  'Propiocepción',
  'Reeducación de aferencias articulares mecanorreceptoras post-esguince de tobillo.',
  'Parado sobre una sola pierna en el centro de un cojín de espuma o superficie blanda. Mantener la mirada al frente y la rodilla ligeramente flexionada durante 30 segundos sin tocar el suelo.',
  3,
  5,
  NULL,
  1,
  'Tobillo / Pie',
  'Estabilizadores articulares de tobillo y rodilla',
  'Control Motor / Propiocepción',
  'BOSU / Inestable',
  'Alto',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. '
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Propiocepción monopodal sobre superficie inestable (BOSU o disco)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Movilidad articular en flexión dorsal de tobillo (Knee to Wall)',
  'Movilidad Articular',
  'Incremento del rango de dorsiflexión talocrural fundamental para la cinemática de la marcha.',
  'De pie frente a una pared a 8-10 cm de distancia. Avanzar la rodilla hacia la pared hasta tocarla sin levantar el talón del suelo. Mantener 2 segundos y regresar.',
  3,
  10,
  NULL,
  1,
  'Tobillo / Pie',
  'Complejo gastro-sóleo y cápsula talocrural anterior',
  'Movilidad Articular',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Suspender ante pinzamiento tibioperoneo anterior o osteofitos dorsales dolorosos.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Movilidad articular en flexión dorsal de tobillo (Knee to Wall)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Recogida de toalla con dedos del pie (Towel Curls plantares)',
  'Fortalecimiento',
  'Tonificación de la fascia plantar e intrínsecos del pie para fascitis plantar o metatarsalgia.',
  'Sentado en una silla descalzo sobre suelo liso con una toalla extendida bajo el pie. Utilizar únicamente los dedos del pie para arrugar y acercar la toalla hacia el talón.',
  3,
  10,
  NULL,
  1,
  'Tobillo / Pie',
  'Flexor corto de los dedos, lumbricales e interóseos plantares',
  'Fortalecimiento Muscular',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar ante calambres plantares agudos recurrentes.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Recogida de toalla con dedos del pie (Towel Curls plantares)');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Automovilización miofascial con pelota bajo arco plantar',
  'Movilidad Articular',
  'Disminución de tensión en la fascia plantar y mejora de propiocepción exteroceptiva.',
  'De pie o sentado, colocar una pelota de tenis o masaje bajo el arco del pie. Rodar la pelota desde el talón hasta los metatarsos ejerciendo una presión moderada y progresiva durante 2 minutos.',
  2,
  10,
  NULL,
  1,
  'Tobillo / Pie',
  'Aponeurosis plantar y músculos intrínsecos',
  'Movilidad Articular',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. No aplicar presión directa sobre espolón calcáneo intensamente inflamado.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Automovilización miofascial con pelota bajo arco plantar');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Estiramiento del complejo gemelo-sóleo contra pared',
  'Estiramiento',
  'Elongación de la cadena posterior sural manteniendo retropié en varo/valgo neutro.',
  'De pie frente a la pared, dar un paso largo atrás con la pierna a estirar. Mantener el talón trasero apoyado en el suelo y rodilla recta, flexionando la pierna adelantada 25 segundos.',
  3,
  3,
  NULL,
  1,
  'Tobillo / Pie',
  'Gastrocnemios medial y lateral y sóleo',
  'Flexibilidad',
  'Sin equipamiento',
  'Bajo',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Evitar tensión brusca en tendón de Aquiles sensible.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Estiramiento del complejo gemelo-sóleo contra pared');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Caminata funcional en talones y puntas de pie',
  'Reeducación Postural',
  'Control dinámico de la fase de apoyo inicial e impulso en la marcha kinesiológica.',
  'Caminar 10 pasos en línea recta apoyando exclusivamente los talones con dedos elevados al máximo. Luego girar y caminar 10 pasos sobre las puntas de los pies manteniendo la pelvis alineada.',
  3,
  8,
  NULL,
  1,
  'Tobillo / Pie',
  'Tibial anterior, gemelos y musculatura de balance dinámico',
  'Reeducación de la Marcha',
  'Sin equipamiento',
  'Medio',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Precaución ante inestabilidad de la marcha sin ayuda técnica.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Caminata funcional en talones y puntas de pie');

INSERT INTO exercises (
  name, category, description, instructions, default_sets, default_repetitions,
  media_url, is_active, body_zone, muscle_group, therapeutic_objective,
  equipment_needed, difficulty_level, contraindications
) SELECT
  'Salto bipodal suave en escalón bajo con aterrizaje silencioso',
  'Rehabilitación Funcional',
  'Readaptación al impacto y almacenamiento elástico tendinoso en fases finales de rehabilitación.',
  'Frente a un escalón firme de 10-15 cm, realizar un salto suave cayendo en el centro del escalón amortiguando con rodillas y tobillos de manera absolutamente silenciosa.',
  3,
  6,
  NULL,
  1,
  'Tobillo / Pie',
  'Tríceps sural, tendón calcáneo y cuádriceps',
  'Control Motor / Propiocepción',
  'Silla / Escalón',
  'Alto',
  'Contenido de referencia clínica demostrativo. Requiere valoración y prescripción individualizada por un profesional kinesiólogo. Contraindicado en fases agudas, artrosis moderada/severa con dolor de carga o inestabilidad articular.'
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Salto bipodal suave en escalón bajo con aterrizaje silencioso');

