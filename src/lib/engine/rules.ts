/**
 * PanicLens — Diagnostic Rules Catalog
 * Version: 1.0.0
 *
 * Each rule is a versionable, explainable diagnostic unit.
 * The engine consumes parsed evidences and produces hypotheses with confidence.
 */

export const RULESET_VERSION = '2.0.0';

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
  /** any = one include hit is enough, all = all include keys must be present */
  includeMode?: 'any' | 'all';
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
    includeMatchers: ['thermalmonitord_no_checkins', 'missing_sensors'],
    includeMode: 'all',
    evidenceWeight: 42, comboBonus: 28,
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
    id: 'rule.thermal.timeout_only',
    version: '1.0.0', name: 'Thermalmonitord sem checkins',
    category: 'thermal',
    description: 'Quando o thermalmonitord não responde, mesmo sem sensores explicitamente ausentes, o chain térmico já merece alta prioridade.',
    includeMatchers: ['thermalmonitord_no_checkins'],
    evidenceWeight: 28,
    severityImpact: 'high',
    primaryHypothesis: 'Falha na cadeia térmica com thermalmonitord sem checkins.',
    secondaryHypothesis: 'Sensor térmico intermitente ou flex degradado não explicitado no log.',
    suspectedComponents: ['sensor térmico', 'flex de bateria', 'conector térmico', 'linha NTC'],
    probableSubsystem: 'Thermal sensing',
    probableRepairTier: 'connector_or_line_check',
    confidenceBase: 62,
    explanationTemplate: 'O thermalmonitord sem checkins ({evidence}) já é um sinal forte de falha na cadeia térmica, mesmo sem missing sensor explícito.',
    recommendedTests: ['Reseat de flex de bateria', 'Inspeção do circuito térmico', 'Comparar continuidade do sensor térmico'],
    suggestedActions: [
      { actionTitle: 'Troca de bateria de teste', actionType: 'swap_test', priority: 1, difficulty: 'low', technicalRisk: 'low', expectedResolutionChance: 30, whyThisAction: 'A NTC da bateria pode ser o ponto de falha mesmo sem sensor ausente explícito.' },
      { actionTitle: 'Medição da linha térmica', actionType: 'measurement', priority: 2, difficulty: 'medium', technicalRisk: 'medium', expectedResolutionChance: 42, whyThisAction: 'Confirma se o problema é linha/flex ou circuito.' },
    ],
    tags: ['thermal', 'timeout'],
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
    id: 'rule.watchdog.process_specific',
    version: '1.0.0', name: 'Watchdog com processo alvo específico',
    category: 'watchdog',
    description: 'Regra mais específica quando o timeout vem acompanhado do processo responsável.',
    includeMatchers: ['userspace_watchdog_timeout', 'wdog_target_process'],
    includeMode: 'all',
    evidenceWeight: 38, comboBonus: 18,
    severityImpact: 'high',
    primaryHypothesis: 'Travamento do processo alvo do watchdog com forte indicação do subsistema correspondente.',
    secondaryHypothesis: 'Falha de periferia ligada ao processo alvo.',
    suspectedComponents: ['subsistema do processo alvo', 'flex associado', 'sensor associado'],
    probableSubsystem: 'Process-bound subsystem',
    probableRepairTier: 'peripheral_diagnosis',
    confidenceBase: 72,
    explanationTemplate: 'Watchdog + processo alvo ({evidence}) reduz ambiguidade e aponta o subsistema certo para iniciar o diagnóstico.',
    recommendedTests: ['Isolar o subsistema do processo', 'Trocar o periférico relacionado', 'Comparar comportamento com e sem periféricos'],
    suggestedActions: [
      { actionTitle: 'Mapear o processo no esquema funcional', actionType: 'inspection', priority: 1, difficulty: 'medium', technicalRisk: 'low', expectedResolutionChance: 45, whyThisAction: 'Transforma o timeout em alvo técnico concreto.' },
      { actionTitle: 'Swap test do periférico do processo', actionType: 'swap_test', priority: 2, difficulty: 'low', technicalRisk: 'low', expectedResolutionChance: 58, whyThisAction: 'Confirma rapidamente se a falha é periférica ou de placa.' },
    ],
    tags: ['watchdog', 'process'],
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
    includeMode: 'all',
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
  {
    id: 'rule.face_id.watchdog_combo',
    version: '1.0.0', name: 'Face ID + watchdog específico',
    category: 'face_id',
    description: 'Combinação de watchdog com biometria/TrueDepth que costuma apontar a cadeia frontal sensível antes do watchdog genérico.',
    includeMatchers: ['userspace_watchdog_timeout', 'face_id_ref'],
    includeMode: 'all',
    optionalMatchers: ['wdog_target_process'],
    evidenceWeight: 48, comboBonus: 24,
    severityImpact: 'high',
    primaryHypothesis: 'Falha na cadeia Face ID/TrueDepth com watchdog subsequente no processo biométrico.',
    secondaryHypothesis: 'Travamento do processo biométrico por falha periférica ou linha frontal.',
    suspectedComponents: ['módulo TrueDepth', 'flex frontal', 'BiometricKitd', 'dot projector'],
    probableSubsystem: 'Face ID / Biometric',
    probableRepairTier: 'connector_or_line_check',
    confidenceBase: 84,
    explanationTemplate: 'Watchdog + Face ID ({evidence}) pede priorização do conjunto frontal e não do watchdog genérico.',
    recommendedTests: ['Swap do conjunto frontal compatível', 'Validar flex e conectores do módulo biométrico'],
    suggestedActions: [
      { actionTitle: 'Validar conjunto frontal compatível', actionType: 'connector_check', priority: 1, difficulty: 'medium', technicalRisk: 'low', expectedResolutionChance: 52, whyThisAction: 'Ajuda a distinguir falha do módulo frontal de um travamento genérico do processo.' },
      { actionTitle: 'Swap test do conjunto frontal', actionType: 'swap_test', priority: 2, difficulty: 'medium', technicalRisk: 'medium', expectedResolutionChance: 62, whyThisAction: 'Se o comportamento mudar, a cadeia frontal deixa de ser uma hipótese abstrata.' },
    ],
    riskNotes: 'Face ID exige cautela comercial e técnica; confirmar impacto da perda funcional antes de avançar.',
    tags: ['face_id', 'watchdog', 'front'],
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
    includeMatchers: ['audio_ref', 'codec_ref'],
    includeMode: 'all',
    optionalMatchers: ['i2c_fault'],
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
  {
    id: 'rule.codec.audio_i2c_combo',
    version: '1.0.0', name: 'Codec + áudio + I2C',
    category: 'codec',
    description: 'Quando áudio, codec e I2C aparecem juntos, a cadeia do codec fica mais provável que o áudio genérico.',
    includeMatchers: ['audio_ref', 'codec_ref', 'i2c_fault'],
    includeMode: 'all',
    evidenceWeight: 42, comboBonus: 26,
    severityImpact: 'high',
    primaryHypothesis: 'Falha na cadeia de codec com dependência direta de I2C/barramento.',
    secondaryHypothesis: 'Falha de áudio secundária provocada pela comunicação do codec.',
    suspectedComponents: ['codec de áudio', 'linha I2C', 'amplificador', 'flex do conjunto de áudio'],
    probableSubsystem: 'Audio / codec',
    probableRepairTier: 'advanced_board_diagnosis',
    confidenceBase: 82,
    explanationTemplate: 'Áudio + codec + I2C ({evidence}) eleva a hipótese de codec acima do áudio genérico.',
    recommendedTests: ['Medir linha I2C do codec', 'Swap test do speaker', 'Inspeção do codec na placa'],
    suggestedActions: [
      { actionTitle: 'Medição detalhada da linha I2C do codec', actionType: 'measurement', priority: 1, difficulty: 'high', technicalRisk: 'medium', expectedResolutionChance: 58, whyThisAction: 'Se a comunicação falha, o codec vira o ponto focal do diagnóstico.' },
      { actionTitle: 'Inspeção do codec na placa', actionType: 'advanced_board_diagnosis', priority: 2, difficulty: 'expert', technicalRisk: 'high', expectedResolutionChance: 45, whyThisAction: 'Se o barramento estiver íntegro, a falha tende a subir para a placa.' },
    ],
    riskNotes: 'Casos com áudio + codec + I2C costumam exigir confirmação em bancada antes de troca de placa.',
    tags: ['audio', 'codec', 'i2c'],
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
  {
    id: 'rule.sensors.missing_specific',
    version: '2.0.0', name: 'Sensores ausentes explicitamente no panic',
    category: 'sensors',
    description: 'O parser extrai nomes de sensores ausentes. Isso normalmente indica falha física de sensor, flex ou linha.',
    includeMatchers: ['missing_sensor_name', 'missing_sensors'],
    includeMode: 'any',
    evidenceWeight: 32, severityImpact: 'high',
    primaryHypothesis: 'Sensor crítico ausente/intermitente (linha, flex ou sensor defeituoso).',
    secondaryHypothesis: 'Mau contato em conector relacionado ao sensor ausente.',
    suspectedComponents: ['sensor citado no log', 'flex do subsistema', 'conector FPC', 'linha de barramento do sensor'],
    probableSubsystem: 'Sensor fabric',
    probableRepairTier: 'connector_or_line_check',
    confidenceBase: 72,
    explanationTemplate: 'Há sensores ausentes no log ({evidence}). Isso é evidência estruturada forte de falha real de leitura física.',
    recommendedTests: ['Identificar sensor exato no esquema', 'Reseat do flex correlato', 'Medição de continuidade na linha do sensor', 'Swap test do periférico ligado ao sensor'],
    suggestedActions: [
      { actionTitle: 'Correlacionar sensor ausente com net no esquema', actionType: 'inspection', priority: 1, difficulty: 'medium', technicalRisk: 'low', expectedResolutionChance: 50, whyThisAction: 'Evita tentativa aleatória e direciona o teste para o ponto certo.' },
      { actionTitle: 'Medição de continuidade da linha do sensor', actionType: 'line_check', priority: 2, difficulty: 'medium', technicalRisk: 'medium', expectedResolutionChance: 58, whyThisAction: 'Confirma se é periférico ou trilha.' },
    ],
    tags: ['sensors', 'structured-evidence'],
  },
  {
    id: 'rule.proximity.standalone',
    version: '2.0.0', name: 'Falha de proximidade',
    category: 'proximity',
    description: 'Referência direta ao sensor de proximidade sem dependência de outras regras.',
    includeMatchers: ['proximity_ref'],
    evidenceWeight: 26, severityImpact: 'moderate',
    primaryHypothesis: 'Sensor de proximidade/front assembly com falha intermitente.',
    suspectedComponents: ['sensor de proximidade', 'front flex', 'conector superior'],
    probableSubsystem: 'Proximity / front sensor',
    probableRepairTier: 'simple_swap',
    confidenceBase: 62,
    explanationTemplate: 'Referências de proximidade encontradas ({evidence}). Priorizar validação do conjunto frontal.',
    recommendedTests: ['Swap do conjunto frontal compatível', 'Reseat de front flex', 'Inspeção de umidade/oxidação no topo'],
    suggestedActions: [
      { actionTitle: 'Swap de front assembly de teste', actionType: 'swap_test', priority: 1, difficulty: 'medium', technicalRisk: 'medium', expectedResolutionChance: 63, whyThisAction: 'Diferencia rapidamente peça periférica de falha de placa.' },
    ],
    tags: ['proximity'],
  },
  {
    id: 'rule.audio.route_stall',
    version: '2.0.0', name: 'Travamento de rota de áudio',
    category: 'audio',
    description: 'Padrão de travamento em stack de áudio, útil mesmo sem referência explícita ao codec.',
    includeMatchers: ['audio_ref'],
    excludeMatchers: ['baseband_panic', 'nand_anomaly', 'codec_ref', 'i2c_fault'],
    evidenceWeight: 24, severityImpact: 'moderate',
    primaryHypothesis: 'Falha no caminho de áudio (codec/amplificador/flex/speaker).',
    suspectedComponents: ['speaker superior/inferior', 'amplificador', 'codec', 'linhas de áudio'],
    probableSubsystem: 'Audio path',
    probableRepairTier: 'peripheral_diagnosis',
    confidenceBase: 58,
    explanationTemplate: 'Evidências de áudio ({evidence}) sem sinal dominante de baseband/storage apontam para stack de áudio.',
    recommendedTests: ['Swap de speaker', 'Inspeção do flex de áudio', 'Medição no codec se persistir'],
    suggestedActions: [
      { actionTitle: 'Swap dos módulos de áudio periféricos', actionType: 'swap_test', priority: 1, difficulty: 'low', technicalRisk: 'low', expectedResolutionChance: 52, whyThisAction: 'Resolve parte relevante dos casos sem micro solda.' },
    ],
    tags: ['audio'],
  },
  {
    id: 'rule.power.pmu_only',
    version: '2.0.0', name: 'Power sequencing/PMU anômalo',
    category: 'power',
    description: 'Sinais diretos de falha de sequenciamento de energia.',
    includeMatchers: ['pmu_power'],
    excludeMatchers: ['rail_instability'],
    evidenceWeight: 28, severityImpact: 'high',
    primaryHypothesis: 'Sequenciamento de energia instável com foco em PMU/PMIC.',
    suspectedComponents: ['PMU/PMIC', 'linhas enable', 'componentes de power key'],
    probableSubsystem: 'Power sequencing',
    probableRepairTier: 'advanced_board_diagnosis',
    confidenceBase: 64,
    explanationTemplate: 'Há indício direto de PMU/power sequencing ({evidence}). O padrão tende a board-level.',
    recommendedTests: ['Medir sinais de enable no boot', 'Validar botão power e linha', 'Termografia em PMIC'],
    suggestedActions: [
      { actionTitle: 'Medição de sequência de power rails', actionType: 'measurement', priority: 1, difficulty: 'expert', technicalRisk: 'high', expectedResolutionChance: 47, whyThisAction: 'Confirma se há estágio específico da sequência quebrando.' },
    ],
    tags: ['power'],
  },
  {
    id: 'rule.front_flex.standalone',
    version: '2.0.0', name: 'Front flex com indícios diretos',
    category: 'front_flex',
    description: 'Regra independente para eventos de front flex, útil quando proximity não aparece.',
    includeMatchers: ['front_flex_ref'],
    excludeMatchers: ['face_id_ref'],
    evidenceWeight: 24, severityImpact: 'moderate',
    primaryHypothesis: 'Falha no front flex/conector superior.',
    suspectedComponents: ['front flex', 'conector superior', 'sensores frontais'],
    probableSubsystem: 'Front assembly',
    probableRepairTier: 'simple_swap',
    confidenceBase: 60,
    explanationTemplate: 'Padrão de front flex detectado ({evidence}) sem evidência forte de Face ID.',
    recommendedTests: ['Reseat e limpeza do conector superior', 'Swap de front flex de teste'],
    suggestedActions: [
      { actionTitle: 'Reseat e limpeza do conector frontal', actionType: 'connector_check', priority: 1, difficulty: 'low', technicalRisk: 'low', expectedResolutionChance: 48, whyThisAction: 'Mau contato é causa frequente após troca de tela.' },
    ],
    tags: ['front_flex'],
  },
  {
    id: 'rule.codec.i2c_hard',
    version: '2.0.0', name: 'Codec com falha de barramento',
    category: 'codec',
    description: 'Regra estrita para quando codec e I2C aparecem juntos.',
    includeMatchers: ['codec_ref', 'i2c_fault'],
    includeMode: 'all',
    evidenceWeight: 38, severityImpact: 'high',
    primaryHypothesis: 'Codec travando o barramento I2C (curto/intermitência/CI degradado).',
    suspectedComponents: ['CI codec', 'SCL/SDA do codec', 'pull-up resistors'],
    probableSubsystem: 'Codec I2C bus',
    probableRepairTier: 'advanced_board_diagnosis',
    confidenceBase: 74,
    explanationTemplate: 'Codec + I2C no mesmo panic ({evidence}) é assinatura forte de falha elétrica no barramento do codec.',
    recommendedTests: ['Osciloscópio em SDA/SCL', 'Injeção/termografia no CI codec', 'Isolamento de consumidores no barramento'],
    suggestedActions: [
      { actionTitle: 'Osciloscópio na linha I2C do codec', actionType: 'measurement', priority: 1, difficulty: 'expert', technicalRisk: 'high', expectedResolutionChance: 62, whyThisAction: 'Evidencia travamento real do barramento para decisão de retrabalho.' },
    ],
    tags: ['codec', 'i2c'],
  },
];

export function getRule(id: string) {
  return RULES.find(r => r.id === id);
}
