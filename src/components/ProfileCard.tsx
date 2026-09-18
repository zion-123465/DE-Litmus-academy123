import { X, Mail, Phone, GraduationCap, Building2, BadgeCheck, Headset } from 'lucide-react';

const LOGO_URL = 'https://www.designarena.ai/u/0af0c461-858d-45e6-8a72-5a9585d1cec0';

interface Props {
  open: boolean;
  onClose: () => void;
  // student object from chat payload, or { isAdmin: true }
  person: any;
  isAdminCard?: boolean;
  onMessage?: (studentId: number) => void;
  showMessageButton?: boolean;
}

export default function ProfileCard({ open, onClose, person, isAdminCard = false, onMessage, showMessageButton = false }: Props) {
  if (!open) return null;

  const name = isAdminCard ? 'Academy Admin' : person?.full_name || person?.sender_name || 'Student';
  const avatar = isAdminCard ? LOGO_URL : person?.avatar_url || null;

  const rows = isAdminCard
    ? [
        { icon: BadgeCheck, label: 'Role', value: 'Administrator · De-Litmus Academy' },
        { icon: Mail, label: 'Support', value: 'Replies here + WhatsApp 08106852839' },
      ]
    : [
        { icon: GraduationCap, label: 'Level / Track', value: person?.level || '—' },
        { icon: Building2, label: 'Department', value: person?.department || '—' },
        { icon: BadgeCheck, label: 'Matric No', value: person?.matric_no || '—' },
        ...(person?.phone ? [{ icon: Phone, label: 'Phone', value: person.phone }] : []),
        ...(person?.email ? [{ icon: Mail, label: 'Email', value: person.email }] : []),
      ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-3xl card-shadow w-full max-w-sm overflow-hidden">
        <div className="bg-navy-950 hero-pattern px-6 pt-8 pb-14 text-center relative">
          <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
          {avatar ? (
            <img src={avatar} alt={name} className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-gold-400 -mb-14 relative z-10 bg-navy-900" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gold-400 text-navy-950 font-extrabold text-4xl flex items-center justify-center mx-auto ring-4 ring-gold-300 -mb-14 relative z-10">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="pt-16 pb-6 px-6 text-center">
          <div className="font-display font-extrabold text-xl text-navy-900">{name}</div>
          {isAdminCard && (
            <span className="badge bg-navy-900 text-gold-300 mt-1.5">★ ADMIN</span>
          )}
          <div className="mt-4 space-y-2 text-left">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 bg-navy-50 border border-navy-100 rounded-xl px-3.5 py-2.5">
                <span className="w-8 h-8 rounded-lg bg-navy-900 text-gold-300 flex items-center justify-center shrink-0">
                  <r.icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{r.label}</div>
                  <div className="text-sm font-bold text-navy-900 truncate">{r.value}</div>
                </div>
              </div>
            ))}
          </div>
          {showMessageButton && !isAdminCard && person?.id && onMessage && (
            <button
              onClick={() => {
                onClose();
                onMessage(person.id);
              }}
              className="mt-4 w-full gold-btn font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Headset className="w-4 h-4" /> Message Privately
            </button>
          )}
          {isAdminCard && showMessageButton && onMessage && (
            <button
              onClick={() => {
                onClose();
                onMessage(-1);
              }}
              className="mt-4 w-full gold-btn font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Headset className="w-4 h-4" /> Chat with Admin
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
