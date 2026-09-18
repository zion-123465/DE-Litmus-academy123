export default function Spinner({ label = 'Loading…', dark = false }: { label?: string; dark?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-gold-400/25"></div>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gold-400 animate-spin"></div>
      </div>
      <p className={`text-sm font-medium ${dark ? 'text-white/70' : 'text-navy-700'}`}>{label}</p>
    </div>
  );
}
