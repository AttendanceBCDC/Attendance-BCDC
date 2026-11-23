import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AttendanceEntry,
  Client,
  PaymentStatus,
  ReconcileStatus,
  SppPackage,
  Therapist,
  TherapistClaim,
  TherapyCode,
  TherapySpecialty,
} from '../types/clinic';

function cleanStr(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function ensureUserProfileAndSeed(uid: string, displayName: string): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data()?.seeded === true) {
      return;
    }

    const safeName = cleanStr(displayName || 'Admin Klinik BCDC', 100);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        displayName: safeName,
        clinicName: 'BCDC Terapi & Kelas Psikolog',
        seeded: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await seedInitialClinicData(uid);

    await updateDoc(userRef, {
      seeded: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

async function seedInitialClinicData(ownerId: string): Promise<void> {
  const tList: Omit<Therapist, 'ownerId'>[] = [
    {
      id: `${ownerId}_t_si`,
      name: 'Nadia Putri, S.Tr.Kes',
      specialty: 'SI',
      roleTitle: 'Terapis Sensori Integrasi',
      monthlyTargetHours: 80,
      active: true,
    },
    {
      id: `${ownerId}_t_tw`,
      name: 'Raka Pratama, A.Md.TW',
      specialty: 'TW',
      roleTitle: 'Terapis Wicara',
      monthlyTargetHours: 72,
      active: true,
    },
    {
      id: `${ownerId}_t_bt`,
      name: 'Dimas Wijaya, S.Psi',
      specialty: 'BT',
      roleTitle: 'Behavior Therapist',
      monthlyTargetHours: 76,
      active: true,
    },
    {
      id: `${ownerId}_t_ot`,
      name: 'Sinta Dewi, S.Tr.OT',
      specialty: 'OT',
      roleTitle: 'Terapis Okupasi',
      monthlyTargetHours: 64,
      active: true,
    },
    {
      id: `${ownerId}_t_e`,
      name: 'Larasati, M.Psi., Psikolog',
      specialty: 'E',
      roleTitle: 'Psikolog Klinis & Kelas',
      monthlyTargetHours: 48,
      active: true,
    },
    {
      id: `${ownerId}_t_rm`,
      name: 'Tari Handayani, S.Pd',
      specialty: 'RM',
      roleTitle: 'Terapis Remedial',
      monthlyTargetHours: 56,
      active: true,
    },
  ];

  // Batch 1: Therapists
  {
    const batch = writeBatch(db);
    for (const t of tList) {
      batch.set(doc(db, 'therapists', t.id), {
        ownerId,
        name: cleanStr(t.name, 100),
        specialty: t.specialty,
        roleTitle: cleanStr(t.roleTitle, 80),
        monthlyTargetHours: t.monthlyTargetHours,
        active: t.active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  const cList: Omit<Client, 'ownerId'>[] = [
    { id: `${ownerId}_c_01`, name: 'Adam Arfathan', program: 'Sensori Integrasi', defaultSppSessions: 4, primaryTherapistId: `${ownerId}_t_si`, active: true },
    { id: `${ownerId}_c_02`, name: 'Alisya Maryam', program: 'SI & Kelas Psikolog', defaultSppSessions: 5, primaryTherapistId: `${ownerId}_t_si`, active: true },
    { id: `${ownerId}_c_03`, name: 'Anna Meisha Arsyah', program: 'Paket Intensif SI+TW+BT', defaultSppSessions: 16, primaryTherapistId: `${ownerId}_t_tw`, active: true },
    { id: `${ownerId}_c_04`, name: 'Arqam Zavari', program: 'SI & Behavior Therapy', defaultSppSessions: 8, primaryTherapistId: `${ownerId}_t_bt`, active: true },
    { id: `${ownerId}_c_05`, name: 'Arrandra Gio Dyaksa', program: 'Paket Intensif SI+TW+BT', defaultSppSessions: 16, primaryTherapistId: `${ownerId}_t_si`, active: true },
    { id: `${ownerId}_c_06`, name: 'Arzio Radhika', program: 'Paket Intensif + Evaluasi', defaultSppSessions: 17, primaryTherapistId: `${ownerId}_t_tw`, active: true },
    { id: `${ownerId}_c_07`, name: 'Assyifa Sienna Hakim', program: 'Sensori Integrasi', defaultSppSessions: 8, primaryTherapistId: `${ownerId}_t_si`, active: true },
    { id: `${ownerId}_c_08`, name: 'Biru Shankara', program: 'Wicara & Kelas Psikolog', defaultSppSessions: 11, primaryTherapistId: `${ownerId}_t_tw`, active: true },
    { id: `${ownerId}_c_09`, name: 'Fabian Adellio Cetta', program: 'SI & Behavior Therapy', defaultSppSessions: 8, primaryTherapistId: `${ownerId}_t_bt`, active: true },
    { id: `${ownerId}_c_10`, name: 'Fakhira Aiza', program: 'Terapi Wicara & SI', defaultSppSessions: 5, primaryTherapistId: `${ownerId}_t_tw`, active: true },
    { id: `${ownerId}_c_11`, name: 'Francesco Benedixio', program: 'Behavior & Sensori Integrasi', defaultSppSessions: 12, primaryTherapistId: `${ownerId}_t_bt`, active: true },
    { id: `${ownerId}_c_12`, name: 'Genaro Abyakta Manaf', program: 'SI & Okupasi', defaultSppSessions: 6, primaryTherapistId: `${ownerId}_t_ot`, active: true },
  ];

  // Batch 2: Clients
  {
    const batch = writeBatch(db);
    for (const c of cList) {
      batch.set(doc(db, 'clients', c.id), {
        ownerId,
        name: cleanStr(c.name, 100),
        program: cleanStr(c.program, 80),
        defaultSppSessions: c.defaultSppSessions,
        primaryTherapistId: c.primaryTherapistId,
        active: c.active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  // Helper to chunk writes <= 300 ops per batch
  const pendingWrites: Array<{ col: string; id: string; data: Record<string, unknown> }> = [];

  const monthKeys = ['2026-01', '2026-02', '2026-03'];
  const feePerSession = 225000;

  for (const mk of monthKeys) {
    for (const c of cList) {
      const pkgId = `${ownerId}_pkg_${mk}_${c.id.split('_').pop()}`;
      pendingWrites.push({
        col: 'sppPackages',
        id: pkgId,
        data: {
          ownerId,
          clientId: c.id,
          monthKey: mk,
          paidSessions: c.defaultSppSessions,
          packageName: `Paket ${c.defaultSppSessions} Sesi`,
          sppFee: c.defaultSppSessions * feePerSession,
          paymentStatus: c.id.endsWith('12') && mk === '2026-01' ? 'Cicilan' : 'Lunas',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }
  }

  // Seed January 2026 entries modeled closely after user's BCDC spreadsheet screenshot
  interface SeedSlot {
    clientIdx: number;
    day: number;
    slot: 1 | 2;
    therapistKey: string;
    code: TherapyCode;
    hours?: number;
  }

  const janEntries: SeedSlot[] = [
    // Adam Arfathan (Sabtu 3, 10, 17, 24 = 4 SI)
    { clientIdx: 0, day: 3, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 0, day: 10, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 0, day: 17, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 0, day: 24, slot: 1, therapistKey: 'si', code: 'SI' },
    // Alisya Maryam (4 SI + 1 E)
    { clientIdx: 1, day: 5, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 1, day: 12, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 1, day: 19, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 1, day: 26, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 1, day: 29, slot: 1, therapistKey: 'e', code: 'E' },
    // Anna Meisha Arsyah (4 SI, 7 TW, 4 BT = 15/16)
    { clientIdx: 2, day: 5, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 2, day: 6, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 2, day: 7, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 2, day: 8, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 2, day: 12, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 2, day: 13, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 2, day: 14, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 2, day: 15, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 2, day: 19, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 2, day: 20, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 2, day: 21, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 2, day: 22, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 2, day: 26, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 2, day: 27, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 2, day: 28, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 2, day: 24, slot: 1, therapistKey: 'e', code: 'Izin' },
    // Arqam Zavari (4 SI, 4 BT = 8/8)
    { clientIdx: 3, day: 5, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 3, day: 6, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 3, day: 9, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 3, day: 13, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 3, day: 20, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 3, day: 23, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 3, day: 26, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 3, day: 30, slot: 1, therapistKey: 'si', code: 'SI' },
    // Arrandra Gio Dyaksa (8 SI, 4 TW, 3 BT, 1 Hangus)
    { clientIdx: 4, day: 5, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 4, day: 6, slot: 1, therapistKey: 'bt', code: 'Hangus' },
    { clientIdx: 4, day: 7, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 4, day: 9, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 4, day: 12, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 4, day: 13, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 4, day: 14, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 4, day: 15, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 4, day: 19, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 4, day: 20, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 4, day: 21, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 4, day: 23, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 4, day: 26, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 4, day: 27, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 4, day: 28, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 4, day: 30, slot: 1, therapistKey: 'tw', code: 'TW' },
    // Arzio Radhika (8 SI, 4 TW, 1 E, 1 Ganti, + Saturday)
    { clientIdx: 5, day: 5, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 5, day: 7, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 5, day: 8, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 5, day: 9, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 5, day: 12, slot: 1, therapistKey: 'si', code: 'Ganti' },
    { clientIdx: 5, day: 14, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 5, day: 15, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 5, day: 19, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 5, day: 21, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 5, day: 22, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 5, day: 27, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 5, day: 27, slot: 2, therapistKey: 'e', code: 'E' },
    { clientIdx: 5, day: 29, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 5, day: 30, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 5, day: 3, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 5, day: 10, slot: 1, therapistKey: 'bt', code: 'Izin' },
    // Assyifa Sienna Hakim (8 SI)
    { clientIdx: 6, day: 6, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 6, day: 8, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 6, day: 13, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 6, day: 15, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 6, day: 20, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 6, day: 22, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 6, day: 27, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 6, day: 29, slot: 1, therapistKey: 'si', code: 'SI' },
    // Biru Shankara (2 SI, 5 TW, 1 E, 3 Ganti, 3 Izin)
    { clientIdx: 7, day: 6, slot: 1, therapistKey: 'tw', code: 'Izin' },
    { clientIdx: 7, day: 8, slot: 1, therapistKey: 'tw', code: 'Izin' },
    { clientIdx: 7, day: 9, slot: 1, therapistKey: 'tw', code: 'Izin' },
    { clientIdx: 7, day: 12, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 7, day: 14, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 7, day: 14, slot: 2, therapistKey: 'tw', code: 'Ganti' },
    { clientIdx: 7, day: 19, slot: 1, therapistKey: 'tw', code: 'Ganti' },
    { clientIdx: 7, day: 21, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 7, day: 21, slot: 2, therapistKey: 'tw', code: 'Ganti' },
    { clientIdx: 7, day: 23, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 7, day: 23, slot: 2, therapistKey: 'e', code: 'E' },
    { clientIdx: 7, day: 28, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 7, day: 30, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 7, day: 15, slot: 1, therapistKey: 'si', code: 'SI' },
    // Fabian Adellio Cetta (3 SI, 3 BT, 1 E, 1 Ganti)
    { clientIdx: 8, day: 5, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 8, day: 9, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 8, day: 13, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 8, day: 20, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 8, day: 23, slot: 1, therapistKey: 'bt', code: 'Izin' },
    { clientIdx: 8, day: 27, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 8, day: 29, slot: 1, therapistKey: 'e', code: 'E' },
    { clientIdx: 8, day: 30, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 8, day: 30, slot: 2, therapistKey: 'si', code: 'Ganti' },
    // Fakhira Aiza (3 SI, 2 TW, 3 Izin)
    { clientIdx: 9, day: 6, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 9, day: 7, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 9, day: 12, slot: 1, therapistKey: 'tw', code: 'Izin' },
    { clientIdx: 9, day: 14, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 9, day: 19, slot: 1, therapistKey: 'tw', code: 'Izin' },
    { clientIdx: 9, day: 21, slot: 1, therapistKey: 'tw', code: 'Izin' },
    { clientIdx: 9, day: 26, slot: 1, therapistKey: 'tw', code: 'TW' },
    { clientIdx: 9, day: 28, slot: 1, therapistKey: 'si', code: 'SI' },
    // Francesco Benedixio (3 SI, 8 BT, 1 Izin)
    { clientIdx: 10, day: 6, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 10, day: 7, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 10, day: 8, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 10, day: 12, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 10, day: 13, slot: 1, therapistKey: 'bt', code: 'Izin' },
    { clientIdx: 10, day: 14, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 10, day: 19, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 10, day: 20, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 10, day: 21, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 10, day: 26, slot: 1, therapistKey: 'bt', code: 'BT' },
    { clientIdx: 10, day: 27, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 10, day: 28, slot: 1, therapistKey: 'bt', code: 'BT' },
    // Genaro Abyakta Manaf (2 SI, 2 Hutang, 1 Izin)
    { clientIdx: 11, day: 12, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 11, day: 12, slot: 2, therapistKey: 'ot', code: 'Hutang' },
    { clientIdx: 11, day: 19, slot: 1, therapistKey: 'si', code: 'SI' },
    { clientIdx: 11, day: 19, slot: 2, therapistKey: 'ot', code: 'Hutang' },
    { clientIdx: 11, day: 26, slot: 1, therapistKey: 'ot', code: 'Izin' },
  ];

  // Add Jan entries
  for (const e of janEntries) {
    const client = cList[e.clientIdx];
    const tId = `${ownerId}_t_${e.therapistKey}`;
    const docId = `${ownerId}_att_2026-01_c${e.clientIdx}_d${e.day}_s${e.slot}`;
    pendingWrites.push({
      col: 'attendanceEntries',
      id: docId,
      data: {
        ownerId,
        monthKey: '2026-01',
        dayOfMonth: e.day,
        slot: e.slot,
        clientId: client.id,
        therapistId: tId,
        code: e.code,
        hours: e.hours ?? 1,
        notes: e.code === 'Izin' ? 'Konfirmasi orang tua H-1' : '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  // Generate Feb 2026 (~82% utilization) & Mar 2026 (~90% utilization) so Pertumbuhan Tingkat Kehadiran trend is clear and realistic
  const febDays = [2, 4, 6, 9, 11, 13, 16, 18, 20, 23, 25, 27, 7, 14, 21, 28];
  const marDays = [2, 3, 5, 6, 9, 10, 12, 13, 16, 17, 23, 24, 26, 27, 30, 31, 7, 14];

  cList.forEach((client, cIdx) => {
    const tId = client.primaryTherapistId;
    const spec = tList.find((t) => t.id === tId)?.specialty || 'SI';
    const febCount = Math.max(3, Math.round(client.defaultSppSessions * 0.85));
    for (let i = 0; i < Math.min(febCount, febDays.length); i++) {
      const day = febDays[i];
      const code: TherapyCode = i === febCount - 1 && cIdx % 4 === 0 ? 'Izin' : i % 5 === 4 ? 'E' : spec;
      const resolvedTherapist = code === 'E' ? `${ownerId}_t_e` : tId;
      pendingWrites.push({
        col: 'attendanceEntries',
        id: `${ownerId}_att_2026-02_c${cIdx}_d${day}_s1`,
        data: {
          ownerId,
          monthKey: '2026-02',
          dayOfMonth: day,
          slot: 1,
          clientId: client.id,
          therapistId: resolvedTherapist,
          code,
          hours: 1,
          notes: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }

    const marCount = Math.max(4, Math.round(client.defaultSppSessions * 0.94));
    for (let i = 0; i < Math.min(marCount, marDays.length); i++) {
      const day = marDays[i];
      const code: TherapyCode = i % 6 === 5 ? 'RM' : i % 4 === 3 ? 'E' : spec;
      const resolvedTherapist = code === 'E' ? `${ownerId}_t_e` : code === 'RM' ? `${ownerId}_t_rm` : tId;
      pendingWrites.push({
        col: 'attendanceEntries',
        id: `${ownerId}_att_2026-03_c${cIdx}_d${day}_s1`,
        data: {
          ownerId,
          monthKey: '2026-03',
          dayOfMonth: day,
          slot: 1,
          clientId: client.id,
          therapistId: resolvedTherapist,
          code,
          hours: 1,
          notes: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }
  });

  // Seed Therapist Claims in Jan 2026: most match system entries, plus 4 realistic discrepancies to demonstrate reconciliation!
  janEntries.forEach((e, idx) => {
    // Skip 2 entries so therapist claim is LESS than system, and alter 2 entries to show discrepancy!
    if (idx === 14 || idx === 38) return;
    const isCodeMismatch = idx === 15; // Anna Meisha tgl 24: system Izin, therapist claimed E (hadir)
    const isHourMismatch = idx === 28; // Arrandra Gio tgl 6: system Hangus, therapist claimed BT 1 jam
    const client = cList[e.clientIdx];
    const tId = `${ownerId}_t_${e.therapistKey}`;

    const claimedCode: TherapyCode = isCodeMismatch ? 'E' : isHourMismatch ? 'BT' : e.code;
    const claimedHours = isCodeMismatch || isHourMismatch ? 1 : e.hours ?? 1;
    const status: ReconcileStatus = isCodeMismatch || isHourMismatch ? 'discrepancy' : 'matched';
    const note = isCodeMismatch
      ? 'Terapis mengisi sesi kelas berjalan, sistem mencatat izin H-1'
      : isHourMismatch
      ? 'Terapis mengisi sesi BT selesai, sistem mencatat Hangus (klien tidak datang)'
      : '';

    pendingWrites.push({
      col: 'therapistClaims',
      id: `${ownerId}_clm_2026-01_c${e.clientIdx}_d${e.day}_s${e.slot}`,
      data: {
        ownerId,
        monthKey: '2026-01',
        dayOfMonth: e.day,
        therapistId: tId,
        clientId: client.id,
        code: claimedCode,
        claimedHours,
        reconcileStatus: status,
        claimNote: note,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  });

  // Extra therapist claim that doesn't exist in system yet (e.g. lupa input ke meja depan)
  pendingWrites.push({
    col: 'therapistClaims',
    id: `${ownerId}_clm_2026-01_extra_1`,
    data: {
      ownerId,
      monthKey: '2026-01',
      dayOfMonth: 31,
      therapistId: `${ownerId}_t_si`,
      clientId: `${ownerId}_c_03`,
      code: 'SI',
      claimedHours: 1,
      reconcileStatus: 'discrepancy',
      claimNote: 'Klaim sesi pengganti Sabtu tgl 31 belum terinput di sistem admin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  });

  pendingWrites.push({
    col: 'therapistClaims',
    id: `${ownerId}_clm_2026-01_extra_2`,
    data: {
      ownerId,
      monthKey: '2026-01',
      dayOfMonth: 29,
      therapistId: `${ownerId}_t_tw`,
      clientId: `${ownerId}_c_09`,
      code: 'TW',
      claimedHours: 1,
      reconcileStatus: 'discrepancy',
      claimNote: 'Klaim sesi TW tgl 29, perlu cek ulang jadwal dengan Psikolog',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  });

  // Commit in chunks of 300
  for (let i = 0; i < pendingWrites.length; i += 300) {
    const chunk = pendingWrites.slice(i, i + 300);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.set(doc(db, item.col, item.id), item.data);
    }
    await batch.commit();
  }
}

export async function addTherapist(
  ownerId: string,
  payload: { name: string; specialty: TherapySpecialty; roleTitle: string; monthlyTargetHours: number }
): Promise<void> {
  const id = makeSafeId('ther');
  const path = `therapists/${id}`;
  try {
    await setDoc(doc(db, 'therapists', id), {
      ownerId,
      name: cleanStr(payload.name, 100),
      specialty: payload.specialty,
      roleTitle: cleanStr(payload.roleTitle, 80),
      monthlyTargetHours: Number(payload.monthlyTargetHours) || 60,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTherapist(
  id: string,
  payload: { name: string; specialty: TherapySpecialty; roleTitle: string; monthlyTargetHours: number; active: boolean }
): Promise<void> {
  const path = `therapists/${id}`;
  try {
    await updateDoc(doc(db, 'therapists', id), {
      name: cleanStr(payload.name, 100),
      specialty: payload.specialty,
      roleTitle: cleanStr(payload.roleTitle, 80),
      monthlyTargetHours: Number(payload.monthlyTargetHours) || 60,
      active: payload.active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addClient(
  ownerId: string,
  payload: { name: string; program: string; defaultSppSessions: number; primaryTherapistId: string }
): Promise<void> {
  const id = makeSafeId('cli');
  const path = `clients/${id}`;
  try {
    await setDoc(doc(db, 'clients', id), {
      ownerId,
      name: cleanStr(payload.name, 100),
      program: cleanStr(payload.program, 80),
      defaultSppSessions: Math.max(0, Number(payload.defaultSppSessions) || 0),
      primaryTherapistId: payload.primaryTherapistId,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateClient(
  id: string,
  payload: { name: string; program: string; defaultSppSessions: number; primaryTherapistId: string; active: boolean }
): Promise<void> {
  const path = `clients/${id}`;
  try {
    await updateDoc(doc(db, 'clients', id), {
      name: cleanStr(payload.name, 100),
      program: cleanStr(payload.program, 80),
      defaultSppSessions: Math.max(0, Number(payload.defaultSppSessions) || 0),
      primaryTherapistId: payload.primaryTherapistId,
      active: payload.active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTherapist(
  therapistId: string,
  affectedClients: Client[],
  fallbackTherapistId?: string
): Promise<void> {
  const path = `therapists/${therapistId}`;
  try {
    if (affectedClients.length > 0 && fallbackTherapistId) {
      const batch = writeBatch(db);
      for (const c of affectedClients) {
        batch.update(doc(db, 'clients', c.id), {
          primaryTherapistId: fallbackTherapistId,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    await deleteDoc(doc(db, 'therapists', therapistId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteClient(clientId: string): Promise<void> {
  const path = `clients/${clientId}`;
  try {
    await deleteDoc(doc(db, 'clients', clientId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertSppPackage(
  ownerId: string,
  existingId: string | null,
  payload: {
    clientId: string;
    monthKey: string;
    paidSessions: number;
    packageName: string;
    sppFee: number;
    paymentStatus: PaymentStatus;
  }
): Promise<void> {
  const id = existingId || makeSafeId('spp');
  const path = `sppPackages/${id}`;
  try {
    if (existingId) {
      await updateDoc(doc(db, 'sppPackages', existingId), {
        paidSessions: Math.max(0, Number(payload.paidSessions) || 0),
        packageName: cleanStr(payload.packageName, 80),
        sppFee: Math.max(0, Number(payload.sppFee) || 0),
        paymentStatus: payload.paymentStatus,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'sppPackages', id), {
        ownerId,
        clientId: payload.clientId,
        monthKey: payload.monthKey,
        paidSessions: Math.max(0, Number(payload.paidSessions) || 0),
        packageName: cleanStr(payload.packageName, 80),
        sppFee: Math.max(0, Number(payload.sppFee) || 0),
        paymentStatus: payload.paymentStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function upsertAttendanceEntry(
  ownerId: string,
  existingId: string | null,
  payload: {
    monthKey: string;
    dayOfMonth: number;
    slot: 1 | 2;
    clientId: string;
    therapistId: string;
    code: TherapyCode;
    hours: number;
    notes: string;
  }
): Promise<void> {
  const id = existingId || makeSafeId('att');
  const path = `attendanceEntries/${id}`;
  try {
    if (existingId) {
      await updateDoc(doc(db, 'attendanceEntries', existingId), {
        therapistId: payload.therapistId,
        code: payload.code,
        hours: Math.max(0, Math.min(12, Number(payload.hours) || 0)),
        notes: cleanStr(payload.notes || '', 240),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'attendanceEntries', id), {
        ownerId,
        monthKey: payload.monthKey,
        dayOfMonth: payload.dayOfMonth,
        slot: payload.slot,
        clientId: payload.clientId,
        therapistId: payload.therapistId,
        code: payload.code,
        hours: Math.max(0, Math.min(12, Number(payload.hours) || 0)),
        notes: cleanStr(payload.notes || '', 240),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteAttendanceEntry(entryId: string): Promise<void> {
  const path = `attendanceEntries/${entryId}`;
  try {
    await deleteDoc(doc(db, 'attendanceEntries', entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addTherapistClaim(
  ownerId: string,
  payload: {
    monthKey: string;
    dayOfMonth: number;
    therapistId: string;
    clientId: string;
    code: TherapyCode;
    claimedHours: number;
    reconcileStatus: ReconcileStatus;
    claimNote: string;
  }
): Promise<void> {
  const id = makeSafeId('clm');
  const path = `therapistClaims/${id}`;
  try {
    await setDoc(doc(db, 'therapistClaims', id), {
      ownerId,
      monthKey: payload.monthKey,
      dayOfMonth: payload.dayOfMonth,
      therapistId: payload.therapistId,
      clientId: payload.clientId,
      code: payload.code,
      claimedHours: Math.max(0, Math.min(12, Number(payload.claimedHours) || 0)),
      reconcileStatus: payload.reconcileStatus,
      claimNote: cleanStr(payload.claimNote || '', 240),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTherapistClaimStatus(
  claimId: string,
  payload: {
    code: TherapyCode;
    claimedHours: number;
    reconcileStatus: ReconcileStatus;
    claimNote: string;
  }
): Promise<void> {
  const path = `therapistClaims/${claimId}`;
  try {
    await updateDoc(doc(db, 'therapistClaims', claimId), {
      code: payload.code,
      claimedHours: Math.max(0, Math.min(12, Number(payload.claimedHours) || 0)),
      reconcileStatus: payload.reconcileStatus,
      claimNote: cleanStr(payload.claimNote || '', 240),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTherapistClaim(claimId: string): Promise<void> {
  const path = `therapistClaims/${claimId}`;
  try {
    await deleteDoc(doc(db, 'therapistClaims', claimId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
