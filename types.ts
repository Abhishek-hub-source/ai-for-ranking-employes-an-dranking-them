export interface AnalyzedEmployee {
  id: string;
  name: string;
  summary: string;
  skills: string[];
  experienceYears: number;
}

export interface RankedEmployee extends AnalyzedEmployee {
  rank: number;
  justification: string;
}

export interface TaskAssignment {
  employeeId: string;
  tasks: string[];
}
