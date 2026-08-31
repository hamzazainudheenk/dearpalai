export type ThreadType = 'patient_doctor' | 'caretaker_doctor' | 'patient_psw' | 'caretaker_psw';
export type SenderRole = 'patient' | 'caretaker' | 'doctor' | 'psw';

export interface CommunicationThread {
  id: string;
  patient_id: string;
  thread_type: ThreadType;
  doctor_id?: string | null;
  psw_id?: string | null;
  caretaker_id?: string | null;
  patient_auth_user_id?: string | null;
  last_message_at: string;
  last_message_preview?: string;
  created_at: string;
  updated_at: string;

  // Enriched UI context metadata
  patient_name?: string;
  patient_phone?: string;
  caretaker_name?: string;
  caretaker_phone?: string;
  caretaker_relationship?: string;
  doctor_name?: string;
  psw_name?: string;
  unread_count?: number;
  referral_status?: string;
  referral_id?: string;
}

export interface CommunicationMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: SenderRole;
  sender_name: string;
  content: string;
  read_at?: string | null;
  created_at: string;
}

export interface CreateThreadDTO {
  patientId: string;
  threadType: ThreadType;
  targetProfessionalId?: string;
}

export interface SendMessageDTO {
  content: string;
}

export interface ThreadFilterQuery {
  roleFilter?: 'all' | 'patients' | 'caretakers';
  unreadOnly?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
