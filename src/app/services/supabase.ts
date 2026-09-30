import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../enviroments/enviroments';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client = createClient(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
  );
}