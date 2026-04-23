
CREATE TABLE public.knowledge_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category diagnostic_category NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content_md TEXT NOT NULL,
  key_symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_components JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_tests JSONB NOT NULL DEFAULT '[]'::jsonb,
  affected_models JSONB NOT NULL DEFAULT '[]'::jsonb,
  typical_severity severity_level,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  author TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_read_published" ON public.knowledge_articles
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_super_admin(auth.uid()));

CREATE POLICY "kb_super_admin_write" ON public.knowledge_articles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_kb_updated BEFORE UPDATE ON public.knowledge_articles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_kb_category ON public.knowledge_articles(category) WHERE status = 'published';

-- Seed: 21 artigos iniciais (um por categoria)
INSERT INTO public.knowledge_articles (category, slug, title, summary, key_symptoms, related_components, recommended_tests, typical_severity, keywords, author, content_md) VALUES
('thermal', 'thermal-monitor-checkin-failure', 'Falhas de checkin do thermalmonitord',
 'Quando o thermalmonitord falha checkins, geralmente um sensor térmico (NTC) está aberto/curto ou seu flex está rompido.',
 '["desligamentos térmicos","aquecimento anormal","reinicializações sob carga"]'::jsonb,
 '["NTC","flex de bateria","flex de placa","conector J-thermal"]'::jsonb,
 '["medir resistência do NTC a 25°C","inspecionar flex térmico em microscópio","comparar leituras com dispositivo saudável"]'::jsonb,
 'high', '["thermal","ntc","sensor","watchdog"]'::jsonb, 'Engine PanicLens',
 E'## Diagnóstico\n\nO thermalmonitord checa periodicamente sensores térmicos. Falhas seguidas indicam sensor inacessível.\n\n### Causas prováveis\n- NTC danificado (curto ou aberto)\n- Flex térmico rompido após queda\n- Solda fria em conector\n\n### Testes\n1. Medir resistência do NTC em frio (~10kΩ típico)\n2. Inspeção visual do flex\n3. Cross-check com outro device do mesmo modelo'),

('sensors', 'sensor-bus-i2c-timeout', 'Timeouts em barramento de sensores',
 'Timeouts repetidos em sensores indicam barramento I2C/SPI travado, geralmente por sensor com falha pulling SDA/SCL para baixo.',
 '["sensor não responde","panic em SensorService","auto-brilho falha"]'::jsonb,
 '["sensor de luz ambiente","giroscópio","acelerômetro","CI de barramento"]'::jsonb,
 '["medir SDA/SCL com osciloscópio","desconectar sensores um a um","verificar pull-ups"]'::jsonb,
 'moderate', '["sensors","i2c","spi","timeout"]'::jsonb, 'Engine PanicLens',
 E'## Sintomas\nSensorService entra em panic quando um device no barramento trava as linhas de clock/data.\n\n## Procedimento\n1. Verificar tensão de pull-up (1.8V típico)\n2. Isolar dispositivos sequencialmente\n3. Trocar sensor suspeito por peça boa'),

('watchdog', 'wdt-cpu-stuck', 'Watchdog timeout — CPU travada',
 'WDT panics indicam que uma CPU/thread não respondeu ao kernel dentro do timeout. Pode ser SoC, RAM ou rail PMIC.',
 '["panic com wdt_bite","reboot durante uso pesado","loop após boot"]'::jsonb,
 '["SoC","PMIC","RAM PoP","capacitores de desacoplamento"]'::jsonb,
 '["verificar rails do PMIC sob carga","reflow controlado","análise de NAND para corrupção"]'::jsonb,
 'critical', '["watchdog","wdt","cpu","panic"]'::jsonb, 'Engine PanicLens',
 E'## Análise\nWDT é último recurso. Indica algo grave: rail caindo, SoC defeituoso ou corrupção severa.\n\n## Não pular etapas\n- Sempre medir rails ANTES de mexer em SoC\n- Verificar se NAND não está corrompida (DFU restore primeiro)'),

('battery', 'battery-vbat-collapse', 'Colapso de VBAT sob carga',
 'Bateria envelhecida ou com célula danificada colapsa VBAT em picos de corrente, gerando panics de power.',
 '["desliga em 30%","não liga sem cabo","bateria swollen"]'::jsonb,
 '["bateria","gauge IC","conector de bateria","BMS"]'::jsonb,
 '["medir VBAT sob load","verificar ciclos via Coconut","trocar por bateria nova certificada"]'::jsonb,
 'moderate', '["battery","vbat","power"]'::jsonb, 'Engine PanicLens',
 E'## Causa\nCélula degradada não sustenta corrente. iOS pode disparar panic protetivo.\n\n## Solução\nTroca da bateria por unidade certificada. Resetar BMS quando aplicável.'),

('charging', 'tristar-charge-fault', 'Falha em Tristar / IC de carga',
 'Tristar danificado por cabo defeituoso ou ESD causa enumeração USB falha e logs de charging.',
 '["não carrega","carrega só em uma posição","Tristar quente"]'::jsonb,
 '["Tristar (IC carga)","conector lightning","capacitores de filtro"]'::jsonb,
 '["medir VBUS no conector","verificar comunicação CC1/CC2","trocar Tristar"]'::jsonb,
 'high', '["charging","tristar","usb","lightning"]'::jsonb, 'Engine PanicLens',
 E'## Procedimento\n1. Inspecionar conector lightning sob microscópio\n2. Medir VBUS com cabo conhecido\n3. Reflow Tristar antes de troca\n4. Após troca, validar carga rápida'),

('dock_flex', 'dock-flex-damaged', 'Flex de dock danificado',
 'Quedas e líquidos comprometem o flex do dock, gerando enumeração USB instável e panics relacionados.',
 '["mic não funciona","carrega intermitente","Face ID afetado em modelos compartilhados"]'::jsonb,
 '["flex de dock","conector lightning","mic inferior"]'::jsonb,
 '["substituir flex de dock","testar todas as funções compartilhadas"]'::jsonb,
 'low', '["dock","flex","lightning"]'::jsonb, 'Engine PanicLens',
 E'## Dica\nSempre testar mic, carga e antena após troca — o flex de dock concentra várias funções.'),

('front_flex', 'front-camera-flex-fault', 'Flex frontal (câmera/sensores) com falha',
 'O flex frontal carrega câmera, sensores e em alguns modelos componentes do Face ID. Danos causam múltiplos panics.',
 '["Face ID indisponível","câmera frontal preta","sensor de proximidade falha"]'::jsonb,
 '["flex frontal","módulo Face ID","sensor de proximidade","câmera frontal"]'::jsonb,
 '["substituir flex frontal completo","nunca trocar peças entre dispositivos (pareamento)"]'::jsonb,
 'moderate', '["front_flex","face_id","camera"]'::jsonb, 'Engine PanicLens',
 E'## Importante\nPeças do Face ID são pareadas. Reaproveitar entre devices NÃO funciona em iPhone X+.'),

('proximity', 'proximity-sensor-stuck', 'Sensor de proximidade travado',
 'Sensor de proximidade travado mantém tela apagada em chamadas e gera entradas em log do front sensor.',
 '["tela não acende em chamada","Face ID lento","brilho automático errático"]'::jsonb,
 '["sensor de proximidade","flex frontal","cola/película mal aplicada"]'::jsonb,
 '["limpar sensor","verificar cola/protetor de tela","trocar flex frontal"]'::jsonb,
 'low', '["proximity","sensor"]'::jsonb, 'Engine PanicLens',
 E'## Solução simples\nMuitas vezes é só película mal aplicada cobrindo o sensor. Sempre testar antes de abrir.'),

('face_id', 'face-id-dot-projector-fault', 'Falha no projetor de pontos do Face ID',
 'Falhas no Romeo/Juliet (dot projector/flood) impossibilitam Face ID. Pareadas via Secure Enclave.',
 '["Face ID indisponível","mensagem reposicione","não enrola novo rosto"]'::jsonb,
 '["dot projector","flood illuminator","IR camera","módulo Face ID completo"]'::jsonb,
 '["validar com diagnóstico Apple","módulo precisa programação Apple Service"]'::jsonb,
 'high', '["face_id","biometric","secure_enclave"]'::jsonb, 'Engine PanicLens',
 E'## Atenção\nFora de programa autorizado Apple, Face ID em geral NÃO é reparável a nível de componente em casa.'),

('camera', 'rear-camera-ois-fault', 'Câmera traseira / OIS com falha',
 'Falhas mecânicas (OIS) ou no CI de câmera disparam panics camerad e crash do app.',
 '["câmera traseira preta","app de câmera fecha","ruído mecânico"]'::jsonb,
 '["módulo de câmera traseira","CI de câmera","flex de câmera"]'::jsonb,
 '["trocar módulo de câmera","verificar pinos do conector","DFU restore antes de hardware"]'::jsonb,
 'moderate', '["camera","ois","camerad"]'::jsonb, 'Engine PanicLens',
 E'## Passos\n1. DFU restore para descartar software\n2. Trocar módulo por peça compatível com modelo exato'),

('audio', 'audio-amp-fault', 'Falha em amplificador de áudio',
 'Amplificador (Cirrus) defeituoso causa panics em audiomxd e sintomas de speaker mudo.',
 '["sem áudio em chamadas","speaker mudo","mic inferior afetado"]'::jsonb,
 '["amplificador Cirrus","alto-falante","capacitores de filtro"]'::jsonb,
 '["medir saída do amp","reflow do CI","trocar CI de áudio"]'::jsonb,
 'moderate', '["audio","cirrus","amp","audiomxd"]'::jsonb, 'Engine PanicLens',
 E'## Dica de bancada\nMicrofusível próximo ao amp queima com frequência — sempre verificar antes de trocar o CI.'),

('codec', 'audio-codec-i2s-fault', 'Codec de áudio I2S com falha',
 'Codec/I2S com falha causa erros de stream e panics em coreaudiod.',
 '["áudio distorcido","ruído estático","perda de canal"]'::jsonb,
 '["codec de áudio","linhas I2S","clock de áudio"]'::jsonb,
 '["verificar clock I2S","medir BCLK/LRCLK","trocar codec"]'::jsonb,
 'moderate', '["codec","i2s","audio"]'::jsonb, 'Engine PanicLens',
 E'## Procedimento\nCodec é um IC sensível a estresse mecânico — reflow antes de troca.'),

('baseband', 'baseband-modem-no-service', 'Baseband sem serviço / panic CommCenter',
 'Baseband travado ou modem com solda comprometida causa panics CommCenter e sem sinal.',
 '["sem serviço","IMEI zerado","searching infinito"]'::jsonb,
 '["modem (Intel/Qualcomm)","RF transceiver","capacitores de RF","conectores de antena"]'::jsonb,
 '["restaurar baseband via DFU","reballing modem","verificar antenas"]'::jsonb,
 'critical', '["baseband","modem","commcenter","rf"]'::jsonb, 'Engine PanicLens',
 E'## Realidade\nReballing de modem é nível avançado. Avaliar custo vs valor do device antes de prosseguir.'),

('modem', 'modem-power-rail-collapse', 'Colapso de rail do modem',
 'Rail de alimentação do modem caindo causa panic durante boot ou registro em rede.',
 '["panic ao registrar rede","reinicia em chamadas","modem aparece e some"]'::jsonb,
 '["PMIC do modem","capacitores de bypass","rail VCC_RF"]'::jsonb,
 '["medir rails do modem","trocar capacitores próximos","substituir PMIC dedicado"]'::jsonb,
 'high', '["modem","rail","pmic"]'::jsonb, 'Engine PanicLens', E'## Nota\nFalhas após troca de tela podem indicar antena mal conectada — sempre revalidar.'),

('nand', 'nand-corruption-restore-fail', 'Corrupção de NAND',
 'NAND corrompida bloqueia boot e gera panics aleatórios. Errors 9/4013/14 em DFU restore são típicos.',
 '["error 9","error 4013","reboot loop","DFU sucesso parcial"]'::jsonb,
 '["NAND","SoC","trilhas NAND-SoC"]'::jsonb,
 '["tentar DFU restore com cabo certificado","reballing NAND","programação direta com NAND programmer"]'::jsonb,
 'critical', '["nand","storage","error_9","error_4013"]'::jsonb, 'Engine PanicLens',
 E'## Atenção\nNAND nunca deve ser trocada sem programação (CPID/ECID). Operação só em bancada equipada.'),

('storage', 'storage-io-errors', 'Erros de I/O em storage',
 'Erros recorrentes de I/O sem corrupção total indicam NAND no fim da vida útil ou trilhas comprometidas.',
 '["app travando","slow boot","Save the Data falha"]'::jsonb,
 '["NAND","controlador de storage","trilhas"]'::jsonb,
 '["benchmark de I/O","DFU restore","substituição planejada de NAND"]'::jsonb,
 'high', '["storage","io","nand"]'::jsonb, 'Engine PanicLens',
 E'## Recomendação\nFazer backup IMEDIATAMENTE. Storage com erros tende a falhar em cascata.'),

('power', 'pmic-rail-instability', 'Instabilidade de rail do PMIC',
 'Rails do PMIC oscilando geram panics aleatórios, freezes e desligamentos.',
 '["panic aleatório","desliga sob carga","esquenta sem motivo"]'::jsonb,
 '["PMIC","capacitores de desacoplamento","indutores"]'::jsonb,
 '["medir todos os rails sob carga","substituir capacitores","reflow PMIC"]'::jsonb,
 'critical', '["power","pmic","rail"]'::jsonb, 'Engine PanicLens',
 E'## Mapa\nManter mapa de rails do modelo em mãos. Cada rail tem tolerância específica.'),

('rail', 'specific-rail-fault', 'Falha em rail específico',
 'Quando o panic aponta um rail nominal (ex: PP1V8), focar a análise nele economiza horas.',
 '["mensagem com nome de rail","componente quente","curto medível"]'::jsonb,
 '["rail apontado","componentes alimentados por ele","capacitor em curto"]'::jsonb,
 '["medir rail com multímetro","termocâmera para localizar curto","remover capacitor por capacitor"]'::jsonb,
 'high', '["rail","short","power"]'::jsonb, 'Engine PanicLens',
 E'## Técnica\nUsar bench PSU em current limit para localizar curto sem queimar nada.'),

('i2c', 'i2c-bus-stuck', 'Barramento I2C travado',
 'Um device puxando SDA ou SCL para baixo trava todo o barramento e gera múltiplos panics.',
 '["múltiplos sensores falham","I2C timeout em log","aquecimento de um IC"]'::jsonb,
 '["devices I2C","resistores de pull-up","trilhas SDA/SCL"]'::jsonb,
 '["isolar devices um a um","medir SDA/SCL em repouso","localizar device em curto"]'::jsonb,
 'moderate', '["i2c","bus","sda","scl"]'::jsonb, 'Engine PanicLens',
 E'## Lembrete\nSDA/SCL devem ficar em ~1.8V em repouso. Se estão em 0V, há device travando o barramento.'),

('cpu_memory', 'cpu-memory-pop-fault', 'Falha em RAM PoP / SoC',
 'Falhas em RAM PoP sobre o SoC causam panics imprevisíveis e DFU instável.',
 '["panic aleatório","DFU restore falha em pontos diferentes","aquecimento do SoC"]'::jsonb,
 '["SoC","RAM PoP","trilhas internas"]'::jsonb,
 '["DFU restore","reflow controlado de SoC/RAM","reballing PoP"]'::jsonb,
 'critical', '["cpu","memory","pop","soc"]'::jsonb, 'Engine PanicLens',
 E'## Realidade comercial\nReballing PoP é nível expert. Avaliar viabilidade econômica.'),

('peripheral_communication', 'peripheral-comm-fault', 'Falha de comunicação periférica',
 'Falhas genéricas em comunicação com periféricos indicam flex/conector intermitente.',
 '["função intermitente","melhora ao pressionar área","piora com calor"]'::jsonb,
 '["flex relacionado","conector","capacitores de filtro"]'::jsonb,
 '["reassentar conectores","substituir flex suspeito","inspeção sob microscópio"]'::jsonb,
 'low', '["peripheral","communication","flex"]'::jsonb, 'Engine PanicLens',
 E'## Método\nIntermitência é o pior. Sempre tentar reproduzir com flexão controlada antes de trocar peças.');
