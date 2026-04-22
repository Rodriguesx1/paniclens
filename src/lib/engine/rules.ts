/**
 * PanicLens — Diagnostic Rules Catalog
 * Version: 1.0.0
 *
 * Each rule is a versionable, explainable diagnostic unit.
 * The engine consumes parsed evidences and produces hypotheses with confidence.
 */

export const RULESET_VERSION = '1.0.0';

export type DiagnosticCategory =
  | 'thermal' | 'sensors' | 'watchdog' | 'battery' | 'charging' | 'dock_flex'
  | 'front_flex' | 'proximity' | 'face_id' | 'camera' | 'audio' | 'codec'
  | 'baseband' | 'modem' | 'nand' | 'storage' | 'power' | 'rail' | 'i2c'
  | 'cpu_memory' | 'peripheral_communication' | 'unknown';

export type RepairTier =
  | 'simple_swap' | 'peripheral_diagnosis' | 'connector_or_line_check'
  | 'advanced_board_diagnosis' | 'high_risk_board_repair';

export type DiagnosticRule = {
  id: string;
  version: string;
  name: string;
  category: DiagnosticCategory;
  description: string;
  /** evidence keys that MUST appear (any of these counts as hit) */
  includeMatchers: string[];
  /** boost matchers — increase confidence if also present */
  optionalMatchers?: string[];
  /** if any of these present, this rule is suppressed/conflicts */
  excludeMatchers?: string[];
  /** weight contributed when any include hits */
  evidenceWeight: number;
  /** added when ALL optional matchers also present (strong combo) */
  comboBonus?: number;
  severityImpact: 'low' | 'moderate' | 'high' | 'critical';
  primaryHypothesis: string;
  secondaryHypothesis?: string;
  suspectedComponents: string[];
  probableSubsystem: string;
  probableRepairTier: RepairTier;
  confidenceBase: number;            // 0..100 base before boosts
  explanationTemplate: string;       // {evidence} placeholder
  recommendedTests: string[];
  suggestedActions: SuggestedAction[];
  riskNotes?: string;
  falsePositiveNotes?: string;
  tags?: string[];
};

export type SuggestedAction = {
  actionTitle: string;
  actionType:
    | 'inspection' | 'swap_test' | 'measurement' | 'connector_check'
    | 'line_check' | 'subsystem_isolation' | 'advanced_board_diagnosis';
  priority: number;            // 1..5
  difficulty: 'low' | 'medium' | 'high' | 'expert';
  estimatedCost?: string;
  estimatedTime?: string;
  technicalRisk: 'low' | 'medium' | 'high';
  expectedResolutionChance: number; // 0..100
  whyThisAction: string;
  whenToEscalate?: string;
};

// ============ CATALOG ============

export const RULES: DiagnosticRule[] = [
  // -------- THERMAL + SENSORS --------
  {
    id: 'rule.thermal.sensors_missing',
    version: '1.0.0', name: 'Thermal monitor sem checkins + sensores ausentes',
    category: 'thermal',
    description: 'thermalmonitord parou de receber checkins enquanto o sistema reporta sensores ausentes. Forte indicativo de sensor térmico interrompido — flex, conexão, ou linha do subsistema correspondente.',
    includeMatchers: ['thermalmonitord_no_checkins'],
    optionalMatchers: ['missing_sensors'],
    evidenceWeight: 35, comboBonus: 25,
    severityImpact: 'high',
    primaryHypothesis: 'Sensor térmico interrompido (flex/linha/circuito) levando o thermalmonitord a falhar checkins.',
    secondaryHypothesis: 'Falha pontual do sensor PMU/skin/das relacionada à malha de leitura.',
    suspectedComponents: ['flex térmico', 'NTC/sensor de temperatura', 'PMU térmica', 'linha de I2C/SPMI do sensor'],
    probableSubsystem: 'Thermal sensing (skin/das/battery/PMU NTCs)',
    probableRepairTier: 'connector_or_line_check',
    confidenceBase: 70,
    explanationTemplate: 'O log mostra "{evidence}". Quando thermalmonitord falha checkins junto com missing sensor(s), a causa típica é uma linha de sensor térmico interrompida — antes de pensar em placa, valide flex/conector/sensor.',
    recommendedTests: [
      'Reseat de flex de bateria e flex de tela',
      'Inspecionar conectores J/L do sensor térmico no esquema',
      'Comparar continuidade das linhas NTC com aparelho funcional',
      'Trocar bateria de teste (NTC interno comum)',
    ],
    suggestedActions: [
      { actionTitle: 'Reseat dos flexíveis principais', actionType: 'connector_check', priority: 1, difficulty: 'low', estimatedTime: '10 min', technicalRisk: 'low', expectedResolutionChance: 25, whyThisAction: 'Mau contato em flex pode interromper a linha do sensor sem dano físico aparente.' },
      { actionTitle: 'Trocar bateria de teste compatível', actionType: 'swap_test', priority: 2, difficulty: 'low', estimatedTime: '15 min', estimatedCost: '$', technicalRisk: 'low', expectedResolutionChance: 35, whyThisAction: 'Sensor NTC da bateria é causa frequente de missing sensor.' },
      { actionTitle: 'Medir continuidade das linhas NTC', actionType: 'measurement', priority: 3, difficulty: 'medium', estimatedTime: '20 min', technicalRisk: 'medium', expectedResolutionChance: 45, whyThisAction: 'Confirmar se o problema é flex/linha antes de partir para placa.', whenToEscalate: 'Se as linhas estiverem íntegras, escalar para diagnóstico de PMU térmica.' },
    ],
    riskNotes: 'Não troque PMU sem antes esgotar testes periféricos.',
    tags: ['thermal', 'sensor', 'common'],
  },
  {
    id: 'rule.thermal.pressure_only',
    version: '1.0.0', name: 'Thermal pressure isolado',
    category: 'thermal',
    description: 'Sinal de pressão térmica sem evidência de sensor ausente.',
    includeMatchers: ['thermal_pressure'],
    excludeMatchers: ['missing_sensors'],
    evidenceWeight: 12, severityImpact: 'low',
    primaryHypothesis: 'Pressão térmica recorrente — possível dissipação comprometida (pasta/blindagem) ou consumo anormal.',
    suspectedComponents: ['dissipação térmica', 'CPU/SoC sob carga', 'bateria degradada'],
    probableSubsystem: 'Thermal management',
    probableRepairTier: 'peripheral_diagnosis',
    confidenceBase: 55,
    explanationTemplate: 'Pressão térmica isolada ({evidence}) costuma ser sintoma operacional, não falha de hardware específica.',
    recommendedTests: ['Verificar saúde da bateria', 'Testar com app limpo', 'Inspecionar blindagens'],
    suggestedActions: [
      { actionTitle: 'Medir consumo em standby', actionType: 'measurement', priority: 1, difficulty: 'medium', technicalRisk: 'low', expectedResolutionChance: 30, whyThisAction: 'Identificar consumo anormal indicando IC com leakage.' },
    ],
    tags: ['thermal'],
  },

  // -------- WATCHDOG --------
  {
    id: 'rule.watchdog.userspace',
    version: '1.0.0', name: 'Userspace watchdog timeout',
    category: 'watchdog',
    description: 'Processo de userspace travou e disparou watchdog. Combinar com processo alvo para localizar subsistema.',
    includeMatchers: ['userspace_watchdog_timeout'],
    optionalMatchers: ['wdog_target_process'],
    evidenceWeight: 30, comboBonus: 15,
    severityImpact: 'high',
    primaryHypothesis: 'Travamento de processo crítico de userspace — investigar subsistema apontado pelo processo.',
    suspectedComponents: ['flex/sensor do subsistema do processo'],
    probableSubsystem: 'Depende do processo (thermal/biometric/audio/...)',
    probableRepairTier: 'peripheral_diagnosis',
    confidenceBase: 60,
    explanationTemplate: 'Watchdog disparado por processo travado: {evidence}. O alvo do timeout indica o subsistema mais provável.',
    recommendedTests: ['Mapear processo alvo', 'Reseat dos flexes correlatos', 'Swap test do periférico do subsistema'],
    suggestedActions: [
      { actionTitle: 'Identificar processo alvo do watchdog', actionType: 'inspection', priority: 1, difficulty: 'low', technicalRisk: 'low', expectedResolutionChance: 40, whyThisAction: 'Fundamental para direcionar troca/medição correta.' },
    ],
    tags: ['watchdog'],
  },
  {
    id: 'rule.watchdog.kernel',
    version: '1.0.0', name: 'Kernel watchdog',
    category: 'watchdog',
    description: 'Watchdog em nível de kernel — geralmente mais grave.',
    includeMatchers: ['kernel_watchdog'],
    evidenceWeight: 28, severityImpact: 'critical',
    primaryHypothesis: 'Travamento de kernel — risco elevado de problema em barramento/placa.',
    suspectedComponents: ['SoC', 'PMU', 'NAND', 'barramento I2C/SPMI'],
    probableSubsystem: 'Kernel / barramentos críticos',
    probableRepairTier: 'advanced_board_diagnosis',
    confidenceBase: 65,
    explanationTemplate: 'Watchdog de kernel ({evidence}) é raramente resolvido por troca simples — investigar barramentos.',
    recommendedTests: ['Testar sem periféricos', 'Inspecionar PMU/PMIC', 'Verificar NAND'],
    suggestedActions: [
      { actionTitle: 'Isolar periféricos e re-testar', actionType: 'subsystem_isolation', priority: 1, difficulty: 'medium', technicalRisk: 'medium', expectedResolutionChance: 35, whyThisAction: 'Confirma se causa é placa ou periférico.' },
    ],
    riskNotes: 'Alto risco de board-level. Avaliar custo/benefício antes de prosseguir.',
    tags: ['watchdog', 'kernel'],
  },

  // -------- BATTERY / CHARGING / DOCK --------
  {
    id: 'rule.battery.comm_failure',
    version: '1.0.0', name: 'Falha de comunicação com bateria',
    category: 'battery',
    description: 'Erro de leitura/autenticação da bateria.',
    includeMatchers: ['battery_comm_failure'],
    optionalMatchers: ['charging_negotiation', 'dock_anomaly'],
    evidenceWeight: 30, comboBonus: 15,
    severityImpact: 'moderate',
    primaryHypothesis: 'Comunicação bateria↔PMU comprometida — bateria, conector ou linha BAT_SWI/SWI.',
    suspectedComponents: ['bateria', 'conector da bateria', 'linha SWI/SMBUS', 'Tristar/Hydra'],
    probableSubsystem: 'Battery management',
    probableRepairTier: 'simple_swap',
    confidenceBase: 70,
    explanationTemplate: 'Detectada falha de comunicação ({evidence}). Comece sempre por bateria/conector antes de assumir circuito.',
    recommendedTests: ['Trocar bateria de teste', 'Inspecionar conector', 'Medir continuidade SWI'],
    suggestedActions: [
      { actionTitle: 'Swap test de bateria', actionType: 'swap_test', priority: 1, difficulty: 'low', estimatedCost: '$', estimatedTime: '15 min', technicalRisk: 'low', expectedResolutionChance: 60, whyThisAction: 'Resolve a maioria das ocorrências; descarta a peça mais comum primeiro.' },
      { actionTitle: 'Inspeção/limpeza do conector', actionType: 'connector_check', priority: 2, difficulty: 'low', technicalRisk: 'low', expectedResolutionChance: 45, whyThisAction: 'Oxidação no FPC é causa recorrente.' },
      { actionTitle: 'Medir linha SWI/SMBUS', actionType: 'measurement', priority: 3, difficulty: 'medium', technicalRisk: 'medium', expectedResolutionChance: 35, whyThisAction: 'Se persistir após troca, valida problema de placa.', whenToEscalate: 'Se linha íntegra e comm continuar falhando, escalar para PMU/Tristar.' },
    ],
    tags: ['battery', 'common'],
  },
  {
    id: 'rule.charging.negotiation',
    version: '1.0.0', name: 'Falha na negociação de carga',
    category: 'charging',
    description: 'Erros relacionados a Tristar/Hydra/PD.',
    includeMatchers: ['charging_negotiation'],
    optionalMatchers: ['dock_anomaly'],
    evidenceWeight: 28, comboBonus: 15,
    severityImpact: 'moderate',
    primaryHypothesis: 'Falha de negociação no Tristar/Hydra (USB-PD).',
    suspectedComponents: ['Tristar/Hydra', 'dock connector', 'cabos/charger usado'],
    probableSubsystem: 'Charging negotiation',
    probableRepairTier: 'connector_or_line_check',
    confidenceBase: 60,
    explanationTemplate: 'Sinais de falha de PD ({evidence}) sugerem investigar primeiro dock e Tristar.',
    recommendedTests: ['Trocar dock', 'Testar com carregador certificado', 'Medir Tristar'],
    suggestedActions: [
      { actionTitle: 'Swap do dock', actionType: 'swap_test', priority: 1, difficulty: 'low', technicalRisk: 'low', expectedResolutionChance: 55, whyThisAction: 'Dock é a peça mais comum nesse padrão.' },
    ],
    tags: ['charging'],
  },
  {
    id: 'rule.dock.anomaly',
    version: '1.0.0', name: 'Anomalia no dock connector',
    category: 'dock_flex',
    description: 'Padrões relacionados a dock/USB.',
    includeMatchers: ['dock_anomaly'],
    evidenceWeight: 22, severityImpact: 'moderate',
    primaryHypothesis: 'Dock connector com mau contato/oxidação ou comunicação anômala.',
    suspectedComponents: ['dock flex', 'pinos do conector', 'linha USB'],
    probableSubsystem: 'Dock/USB',
    probableRepairTier: 'simple_swap',
    confidenceBase: 60,
    explanationTemplate: 'Padrões de dock ({evidence}) — começar por inspeção e troca do flex.',
    recommendedTests: ['Inspeção microscópica', 'Trocar dock', 'Limpeza ultrassom'],
    suggestedActions: [
      { actionTitle: 'Inspeção microscópica do conector', actionType: 'inspection', priority: 1, difficulty: 'low', technicalRisk: 'low', expectedResolutionChance: 40, whyThisAction: 'Detecta corrosão e pinos danificados.' },
      { actionTitle: 'Swap test de dock', actionType: 'swap_test', priority: 2, difficulty: 'low', technicalRisk: 'low', expectedResolutionChance: 55, whyThisAction: 'Confirma rapidamente a causa periférica.' },
    ],
    tags: ['dock'],
  },

  // -------- FRONT FLEX / PROXIMITY / FACE ID --------
  {
    id: 'rule.front_flex.proximity_combo',
    version: '1.0.0', name: 'Front flex + proximity correlato',
    category: 'front_flex',
    description: 'Quando proximity e front flex aparecem juntos, geralmente é o conjunto frontal.',
    includeMatchers: ['front_flex_ref', 'proximity_ref'],
    evidenceWeight: 35, severityImpact: 'moderate',
    primaryHypothesis: 'Conjunto frontal (front flex) com falha — testar antes de partir para placa.',
    suspectedComponents: ['conjunto frontal', 'flex superior', 'sensor de proximidade'],
    probableSubsystem: 'Front sensors',
    probableRepairTier: 'simple_swap',
    confidenceBase: 70,
    explanationTemplate: 'Combinação de evidências do front flex e proximity ({evidence}) aponta para o conjunto frontal compatível.',
    recommendedTests: ['Swap do conjunto frontal compatível', 'Reseat do flex superior'],
    suggestedActions: [
      { actionTitle: 'Swap do front flex compatível', actionType: 'swap_test', priority: 1, difficulty: 'medium', technicalRisk: 'medium', expectedResolutionChance: 65, whyThisAction: 'Forma rápida de validar a hipótese principal.' },
    ],
    tags: ['front_flex', 'proximity'],
  },
  {
    id: 'rule.face_id.ref',
    version: '1.0.0', name: 'Face ID — alta sensibilidade',
    category: 'face_id',
    description: 'Qualquer indício relacionado ao Face ID exige cautela técnica máxima.',
    includeMatchers: ['face_id_ref'],
    evidenceWeight: 35, severityImpact: 'high',
    primaryHypothesis: 'Falha em módulo Face ID/TrueDepth — reparo é altamente sensível.',
    suspectedComponents: ['módulo TrueDepth', 'flood illuminator', 'dot projector', 'flex'],
    probableSubsystem: 'Face ID / Biometric',
    probableRepairTier: 'high_risk_board_repair',
    confidenceBase: 65,
    explanationTemplate: 'Evidência ligada ao Face ID detectada ({evidence}). Troca do módulo desemparelha o Face ID — avaliar com cliente.',
    recommendedTests: ['Validar conexões do conjunto frontal', 'Confirmar histórico de quedas/umidade'],
    suggestedActions: [
      { actionTitle: 'Confirmar com cliente impacto da perda do Face ID', actionType: 'inspection', priority: 1, difficulty: 'low', technicalRisk: 'low', expectedResolutionChance: 50, whyThisAction: 'Decisão comercial precede o técnico nesse caso.' },
    ],
    riskNotes: 'Face ID é sensível: troca de módulo costuma desativar a feature.',
    tags: ['face_id', 'risk'],
  },

  // -------- CAMERA / AUDIO / CODEC --------
  {
    id: 'rule.camera.ref',
    version: '1.0.0', name: 'Padrão de câmera',
    category: 'camera',
    description: 'Indícios de panic relacionado à câmera/ISP.',
    includeMatchers: ['camera_ref'],
    evidenceWeight: 25, severityImpact: 'moderate',
    primaryHypothesis: 'Falha em módulo de câmera ou linha do ISP.',
    suspectedComponents: ['câmera traseira', 'câmera frontal', 'flex de câmera', 'ISP'],
    probableSubsystem: 'Camera / ISP',
    probableRepairTier: 'simple_swap',
    confidenceBase: 60,
    explanationTemplate: 'Padrão de câmera detectado ({evidence}). Iniciar por swap test do módulo.',
    recommendedTests: ['Swap test módulo', 'Reseat flex'],
    suggestedActions: [
      { actionTitle: 'Swap do módulo de câmera', actionType: 'swap_test', priority: 1, difficulty: 'medium', technicalRisk: 'medium', expectedResolutionChance: 60, whyThisAction: 'Causa mais comum.' },
    ],
    tags: ['camera'],
  },
  {
    id: 'rule.audio.codec_combo',
    version: '1.0.0', name: 'Áudio + codec correlato',
    category: 'codec',
    description: 'Áudio falhando com referências a codec.',
    includeMatchers: ['audio_ref'],
    optionalMatchers: ['codec_ref', 'i2c_fault'],
    evidenceWeight: 22, comboBonus: 20,
    severityImpact: 'moderate',
    primaryHypothesis: 'Falha no codec de áudio ou na linha I2C do codec.',
    suspectedComponents: ['codec de áudio', 'linha I2C', 'amplificador', 'speaker'],
    probableSubsystem: 'Audio / codec',
    probableRepairTier: 'advanced_board_diagnosis',
    confidenceBase: 60,
    explanationTemplate: 'Padrões de áudio com codec ({evidence}) sugerem investigar linha I2C do codec antes de cogitar troca.',
    recommendedTests: ['Medir linha I2C do codec', 'Inspeção visual do CI', 'Swap de speaker'],
    suggestedActions: [
      { actionTitle: 'Medição da linha I2C do codec', actionType: 'measurement', priority: 1, difficulty: 'high', technicalRisk: 'medium', expectedResolutionChance: 55, whyThisAction: 'Identifica curto/abertura comum em quedas.' },
    ],
    tags: ['audio', 'codec'],
  },

  // -------- BASEBAND / MODEM --------
  {
    id: 'rule.baseband.panic',
    version: '1.0.0', name: 'Baseband panic',
    category: 'baseband',
    description: 'Panic originada na baseband/CommCenter.',
    includeMatchers: ['baseband_panic'],
    evidenceWeight: 45, severityImpact: 'critical',
    primaryHypothesis: 'Falha na baseband — alto risco de board-level (BB CPU, RAM BB, EEPROM).',
    suspectedComponents: ['BB CPU', 'BB EEPROM', 'BB RAM', 'PMU BB'],
    probableSubsystem: 'Baseband',
    probableRepairTier: 'high_risk_board_repair',
    confidenceBase: 80,
    explanationTemplate: 'Baseband panic ({evidence}) raramente é troca simples. Avaliar custo de reparo de placa.',
    recommendedTests: ['Validar IMEI', 'Inspeção blindagem BB', 'Avaliar histórico (umidade/queda)'],
    suggestedActions: [
      { actionTitle: 'Avaliar viabilidade de board repair', actionType: 'advanced_board_diagnosis', priority: 1, difficulty: 'expert', technicalRisk: 'high', expectedResolutionChance: 40, whyThisAction: 'Sem reparo de placa, geralmente o aparelho não recupera comunicação.', whenToEscalate: 'Encaminhar a laboratório de micro solda especializado.' },
    ],
    riskNotes: 'Baseband repair exige equipamento e experiência específicos.',
    tags: ['baseband', 'risk', 'board-level'],
  },
  {
    id: 'rule.modem.crash',
    version: '1.0.0', name: 'Modem crash',
    category: 'modem',
    description: 'Reset/crash recorrente do modem.',
    includeMatchers: ['modem_crash'],
    evidenceWeight: 38, severityImpact: 'high',
    primaryHypothesis: 'Modem instável — investigar PMU do modem e linhas RF.',
    suspectedComponents: ['modem', 'PMU modem', 'linhas RF'],
    probableSubsystem: 'Modem',
    probableRepairTier: 'advanced_board_diagnosis',
    confidenceBase: 65,
    explanationTemplate: 'Crashes de modem ({evidence}) costumam exigir diagnóstico de placa.',
    recommendedTests: ['Verificar firmware', 'Validar antena', 'Medir alimentação modem'],
    suggestedActions: [
      { actionTitle: 'Medir trilhos de alimentação do modem', actionType: 'measurement', priority: 1, difficulty: 'high', technicalRisk: 'medium', expectedResolutionChance: 45, whyThisAction: 'Identifica PMU defeituosa.' },
    ],
    tags: ['modem'],
  },

  // -------- NAND / STORAGE --------
  {
    id: 'rule.nand.anomaly',
    version: '1.0.0', name: 'NAND anomaly',
    category: 'nand',
    description: 'Erros de NAND/NVMe.',
    includeMatchers: ['nand_anomaly'],
    optionalMatchers: ['storage_io_failure'],
    evidenceWeight: 45, comboBonus: 20,
    severityImpact: 'critical',
    primaryHypothesis: 'NAND/NVMe falhando — alto risco de placa.',
    suspectedComponents: ['NAND', 'controlador NVMe', 'linhas DATA'],
    probableSubsystem: 'Storage / NAND',
    probableRepairTier: 'high_risk_board_repair',
    confidenceBase: 80,
    explanationTemplate: 'Indícios de NAND ({evidence}) raramente recuperam sem retrabalho da NAND.',
    recommendedTests: ['Astris/Purple', 'Restauração via DFU', 'Verificar sintomas físicos'],
    suggestedActions: [
      { actionTitle: 'Tentar restauração DFU monitorada', actionType: 'subsystem_isolation', priority: 1, difficulty: 'medium', technicalRisk: 'medium', expectedResolutionChance: 25, whyThisAction: 'Descarta firmware corrompido.', whenToEscalate: 'Falhando, encaminhar para retrabalho de NAND.' },
    ],
    riskNotes: 'Reparo de NAND exige reballing/programação serial.',
    tags: ['nand', 'risk'],
  },
  {
    id: 'rule.storage.io',
    version: '1.0.0', name: 'Storage I/O failure',
    category: 'storage',
    description: 'Falhas APFS/IO sem indício direto de NAND.',
    includeMatchers: ['storage_io_failure'],
    excludeMatchers: ['nand_anomaly'],
    evidenceWeight: 28, severityImpact: 'high',
    primaryHypothesis: 'Erros de filesystem — possível corrupção lógica ou início de degradação de storage.',
    suspectedComponents: ['NAND (lógico)', 'iOS'],
    probableSubsystem: 'Storage logical',
    probableRepairTier: 'peripheral_diagnosis',
    confidenceBase: 55,
    explanationTemplate: 'I/O errors no log ({evidence}) — antes de placa, tentar restauração.',
    recommendedTests: ['Restore DFU', 'fsck via diag'],
    suggestedActions: [
      { actionTitle: 'Restauração DFU', actionType: 'subsystem_isolation', priority: 1, difficulty: 'low', technicalRisk: 'low', expectedResolutionChance: 50, whyThisAction: 'Descarta corrupção lógica.' },
    ],
    tags: ['storage'],
  },

  // -------- POWER / RAIL / I2C --------
  {
    id: 'rule.power.rail',
    version: '1.0.0', name: 'Instabilidade de rail/PMU',
    category: 'rail',
    description: 'Indícios de rail/PMU instáveis.',
    includeMatchers: ['rail_instability', 'pmu_power'],
    evidenceWeight: 30, severityImpact: 'high',
    primaryHypothesis: 'Rail de alimentação instável — investigar PMU/PMIC e capacitância da linha.',
    suspectedComponents: ['PMU/PMIC', 'capacitores de filtro', 'IC alvo do rail'],
    probableSubsystem: 'Power management',
    probableRepairTier: 'advanced_board_diagnosis',
    confidenceBase: 65,
    explanationTemplate: 'Rail/PMU instável ({evidence}) — medir trilho com osciloscópio.',
    recommendedTests: ['Medir rail', 'Testar carga sequencial', 'Inspecionar capacitores'],
    suggestedActions: [
      { actionTitle: 'Medição do trilho com osciloscópio', actionType: 'measurement', priority: 1, difficulty: 'expert', technicalRisk: 'high', expectedResolutionChance: 50, whyThisAction: 'Identifica IC consumidor anômalo ou PMU defeituosa.' },
    ],
    tags: ['power', 'rail'],
  },
  {
    id: 'rule.i2c.fault',
    version: '1.0.0', name: 'Falha de barramento I2C',
    category: 'i2c',
    description: 'I2C com timeout/NAK.',
    includeMatchers: ['i2c_fault'],
    evidenceWeight: 28, severityImpact: 'moderate',
    primaryHypothesis: 'Comunicação I2C instável — periférico do barramento ou linha em curto.',
    suspectedComponents: ['periférico I2C', 'pull-ups', 'linha SDA/SCL'],
    probableSubsystem: 'I2C bus',
    probableRepairTier: 'advanced_board_diagnosis',
    confidenceBase: 60,
    explanationTemplate: 'Falhas I2C ({evidence}) — isolar periféricos do barramento progressivamente.',
    recommendedTests: ['Isolar periféricos um a um', 'Medir SDA/SCL', 'Verificar pull-ups'],
    suggestedActions: [
      { actionTitle: 'Isolamento progressivo de periféricos', actionType: 'subsystem_isolation', priority: 1, difficulty: 'high', technicalRisk: 'medium', expectedResolutionChance: 55, whyThisAction: 'Identifica IC defeituoso travando o barramento.' },
    ],
    tags: ['i2c'],
  },

  // -------- CPU / MEMORY / PERIPHERAL --------
  {
    id: 'rule.cpu.data_abort',
    version: '1.0.0', name: 'Kernel data abort / acesso de memória inválido',
    category: 'cpu_memory',
    description: 'Acesso inválido em endereço crítico.',
    includeMatchers: ['kernel_data_abort'],
    evidenceWeight: 38, severityImpact: 'critical',
    primaryHypothesis: 'Falha grave em CPU/memória — alta probabilidade de board-level ou degradação severa.',
    suspectedComponents: ['SoC', 'RAM', 'PoP'],
    probableSubsystem: 'CPU / Memory',
    probableRepairTier: 'high_risk_board_repair',
    confidenceBase: 70,
    explanationTemplate: 'Data abort ({evidence}) raramente sai com troca simples.',
    recommendedTests: ['Restore DFU', 'Avaliar histórico físico/úmido'],
    suggestedActions: [
      { actionTitle: 'Avaliar viabilidade de board repair', actionType: 'advanced_board_diagnosis', priority: 1, difficulty: 'expert', technicalRisk: 'high', expectedResolutionChance: 25, whyThisAction: 'Pre-empta tentativas inúteis de troca.' },
    ],
    riskNotes: 'Comunicar cliente sobre risco e custo.',
    tags: ['cpu_memory', 'risk'],
  },
  {
    id: 'rule.peripheral.bus',
    version: '1.0.0', name: 'Falha em barramento periférico (SPMI/SPI)',
    category: 'peripheral_communication',
    description: 'Indícios de falha em SPMI/SPI.',
    includeMatchers: ['peripheral_bus'],
    evidenceWeight: 22, severityImpact: 'moderate',
    primaryHypothesis: 'Comunicação periférica comprometida.',
    suspectedComponents: ['barramento SPMI/SPI', 'periféricos do barramento'],
    probableSubsystem: 'Peripheral bus',
    probableRepairTier: 'advanced_board_diagnosis',
    confidenceBase: 55,
    explanationTemplate: 'Falha de barramento ({evidence}) demanda isolamento periférico.',
    recommendedTests: ['Isolamento periférico', 'Medição do barramento'],
    suggestedActions: [
      { actionTitle: 'Isolar periféricos do barramento', actionType: 'subsystem_isolation', priority: 1, difficulty: 'high', technicalRisk: 'medium', expectedResolutionChance: 45, whyThisAction: 'Identifica origem do bloqueio.' },
    ],
    tags: ['peripheral'],
  },
];

export function getRule(id: string) {
  return RULES.find(r => r.id === id);
}
