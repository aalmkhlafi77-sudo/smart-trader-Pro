/**
 * نقطة الوصول الوحيدة لطبقة التخزين — اتجاه التصميم: "دفتر الميناء"
 * الشاشات تستورد `db` فقط. لتحويل التطبيق إلى SQLite يتم تغيير السطر أدناه وحده.
 */

import { hybridRepository } from "./hybridRepository";
import type { Repository } from "./repository";

export const db: Repository = hybridRepository;
export const STORAGE_ENGINE = "Hybrid IndexedDB/MySQL" as const;

export * from "./schema";
export type { BackupPayload, Repository } from "./repository";
