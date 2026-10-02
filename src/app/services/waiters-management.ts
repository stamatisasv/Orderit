import { Injectable, inject } from '@angular/core';
import { FunctionsHttpError, FunctionsFetchError } from '@supabase/supabase-js';
import { SupabaseService } from './supabase';

export interface Waiter {
  user_id: string;
  name: string;
  email: string;
  email_confirmed_at: string | null;
}
@Injectable({ providedIn: 'root' })
export class WaitersManagementService {
  private db = inject(SupabaseService).client;
  async list(): Promise<Waiter[]> {
    const { data, error } = await this.db.rpc('list_waiters');
    if (error) throw error;
    return data ?? [];
  }
  async invite(email: string, name: string) {
    const { data, error } = await this.db.functions.invoke('invite-waiter', {
      body: { email: email.trim(), name: name.trim() },
    });
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new Error(body?.error ?? 'Unable to invite this waiter.');
    }
    if (error instanceof FunctionsFetchError)
      throw new Error(
        'Invitation service is unavailable. Ask the owner to finish invitation setup.',
      );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  }
  async create(email: string, name: string, password: string) {
    const { data, error } = await this.db.functions.invoke('create-waiter', {
      body: { email: email.trim(), name: name.trim(), password },
    });
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new Error(body?.error ?? 'Unable to create this waiter.');
    }
    if (error instanceof FunctionsFetchError)
      throw new Error(
        'Waiter creation is unavailable. The developer needs to deploy create-waiter.',
      );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  }
  async add(email: string, name: string) {
    const { error } = await this.db.rpc('add_waiter_by_email', {
      p_email: email.trim(),
      p_name: name.trim(),
    });
    if (error) throw error;
  }
  async rename(waiter: Waiter, name: string) {
    const { error } = await this.db.rpc('rename_waiter', {
      p_user_id: waiter.user_id,
      p_name: name.trim(),
      p_expected_name: waiter.name,
    });
    if (error) throw error;
  }
  async remove(waiter: Waiter) {
    const { error } = await this.db.rpc('remove_waiter', {
      p_user_id: waiter.user_id,
      p_expected_name: waiter.name,
    });
    if (error) throw error;
  }
}
