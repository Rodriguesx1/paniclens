export type CaseStatus =
  | 'open'
  | 'analyzed'
  | 'in_repair'
  | 'resolved'
  | 'escalated'
  | 'closed';

export type CaseStatusMeta = {
  label: string;
  description: string;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'destructive';
  step: number;
};

export const CASE_STATUSES: CaseStatus[] = ['open', 'analyzed', 'in_repair', 'escalated', 'resolved', 'closed'];

export const CASE_STATUS_META: Record<CaseStatus, CaseStatusMeta> = {
  open: {
    label: 'Recebido',
    description: 'Caso criado e aguardando triagem inicial.',
    tone: 'neutral',
    step: 1,
  },
  analyzed: {
    label: 'Analisado',
    description: 'Parser e engine já geraram hipótese técnica.',
    tone: 'info',
    step: 2,
  },
  in_repair: {
    label: 'Em reparo',
    description: 'Técnico executando testes, troca ou medição.',
    tone: 'warning',
    step: 3,
  },
  escalated: {
    label: 'Escalado',
    description: 'Caso complexo ou board-level encaminhado.',
    tone: 'destructive',
    step: 4,
  },
  resolved: {
    label: 'Resolvido',
    description: 'Falha confirmada e solução aplicada com sucesso.',
    tone: 'success',
    step: 5,
  },
  closed: {
    label: 'Fechado',
    description: 'Caso finalizado e entregue ao cliente.',
    tone: 'neutral',
    step: 6,
  },
};

export const CASE_STATUS_FLOW: Record<CaseStatus, CaseStatus[]> = {
  open: ['analyzed', 'in_repair', 'escalated', 'resolved', 'closed'],
  analyzed: ['in_repair', 'escalated', 'resolved', 'closed'],
  in_repair: ['resolved', 'escalated', 'closed'],
  escalated: ['resolved', 'closed'],
  resolved: ['closed', 'open'],
  closed: ['open'],
};

export function getCaseStatusMeta(status: string | null | undefined): CaseStatusMeta {
  return CASE_STATUS_META[(status as CaseStatus) ?? 'open'] ?? CASE_STATUS_META.open;
}

export function getCaseStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'open':
      return 'bg-muted text-muted-foreground border-border';
    case 'analyzed':
      return 'bg-info/15 text-info border-info/30';
    case 'in_repair':
      return 'bg-warning/15 text-warning border-warning/30';
    case 'escalated':
      return 'bg-destructive/15 text-destructive border-destructive/30';
    case 'resolved':
      return 'bg-success/15 text-success border-success/30';
    case 'closed':
      return 'bg-secondary text-secondary-foreground border-border';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export function getAvailableCaseTransitions(status: string | null | undefined): CaseStatus[] {
  return CASE_STATUS_FLOW[(status as CaseStatus) ?? 'open'] ?? CASE_STATUS_FLOW.open;
}

export function isTerminalCaseStatus(status: string | null | undefined): boolean {
  return status === 'resolved' || status === 'closed';
}
