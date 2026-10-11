export interface CompanyProfileShape {
  taxId?: string | null;
  legalName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ProfileField {
  key: keyof CompanyProfileShape;
  label: string;
  weight: number;
  validate: (value: string | null | undefined) => boolean;
}

export const PROFILE_FIELDS: ProfileField[] = [
  { key: 'taxId', label: 'RUC', weight: 30, validate: (v) => !!v && /^\d{11}$/.test(v) },
  { key: 'legalName', label: 'Razón Social', weight: 25, validate: (v) => !!v && v.length >= 3 },
  { key: 'address', label: 'Dirección', weight: 20, validate: (v) => !!v && v.length >= 10 },
  { key: 'phone', label: 'Teléfono', weight: 15, validate: (v) => !!v },
  { key: 'email', label: 'Email', weight: 10, validate: (v) => !!v && /@/.test(v) },
];

export interface ProfileEvaluation {
  score: number;
  totalFields: number;
  completedFields: number;
  missingFields: string[];
  complete: boolean;
}

export function evaluateProfile(company: CompanyProfileShape): ProfileEvaluation {
  let score = 0;
  let completedFields = 0;
  const missingFields: string[] = [];

  for (const field of PROFILE_FIELDS) {
    const value = company[field.key];
    if (field.validate(value)) {
      score += field.weight;
      completedFields++;
    } else {
      missingFields.push(field.label);
    }
  }

  return {
    score,
    totalFields: PROFILE_FIELDS.length,
    completedFields,
    missingFields,
    complete: completedFields === PROFILE_FIELDS.length,
  };
}

export function isProfileComplete(company: CompanyProfileShape): boolean {
  return evaluateProfile(company).complete;
}