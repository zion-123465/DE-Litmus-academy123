import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { apiFetch, formatCategory } from '../../lib/api';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import { EmptyState } from '../../components/ui';

const EMPTY = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', marks: 1 };

export default function AdminQuestions() {
  const [params] = useSearchParams();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [quizId, setQuizId] = useState(params.get('quiz') || '');
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkMsg, setBulkMsg] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<{ answer: string; confidence: number; explanation: string; method: string } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteMsg, setPasteMsg] = useState('');
  const [arranged, setArranged] = useState<any[]>([]);
  const [unparsed, setUnparsed] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const q = await apiFetch<any[]>('/api/quizzes');
        setQuizzes(q);
        if (!params.get('quiz') && q.length) setQuizId(String(q[0].id));
        else if (params.get('quiz')) setQuizId(params.get('quiz')!);
      } catch (e) { console.error(e); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (quizId) fetchQuestions();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<any[]>(`/api/questions?quiz_id=${quizId}`, { admin: true });
      setQuestions(d);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setError('');
    setAiResult(null);
    setModalOpen(true);
  };

  const openEdit = (q: any) => {
    setEditing(q);
    setForm({ question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option, marks: q.marks });
    setError('');
    setAiResult(null);
    setModalOpen(true);
  };

  const detectAnswer = async () => {
    setError('');
    setAiResult(null);
    if (!form.question_text.trim() || !form.option_a.trim() || !form.option_b.trim()) {
      setError('Enter the question and at least options A and B before AI detection.');
      return;
    }
    setAiBusy(true);
    try {
      const r = await apiFetch<{ answer: string; confidence: number; explanation: string; method: string }>('/api/ai-detect', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({
          question_text: form.question_text,
          option_a: form.option_a,
          option_b: form.option_b,
          option_c: form.option_c,
          option_d: form.option_d,
        }),
      });
      setAiResult(r);
      setForm((f: any) => ({ ...f, correct_option: r.answer }));
    } catch (e: any) {
      setError(e.message || 'AI detection failed.');
    } finally {
      setAiBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.question_text.trim()) return setError('Question text is required.');
    if (!form.option_a.trim() || !form.option_b.trim()) return setError('At least options A and B are required.');
    setBusy(true);
    try {
      if (editing) {
        await apiFetch('/api/questions', { method: 'PUT', admin: true, body: JSON.stringify({ id: editing.id, ...form }) });
      } else {
        await apiFetch('/api/questions', { method: 'POST', admin: true, body: JSON.stringify({ quiz_id: Number(quizId), ...form }) });
      }
      setModalOpen(false);
      fetchQuestions();
    } catch (e: any) {
      setError(e.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this question?')) return;
    try {
      await apiFetch('/api/questions', { method: 'DELETE', admin: true, body: JSON.stringify({ id }) });
      fetchQuestions();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const arrangePasted = async () => {
    setPasteMsg('');
    setArranged([]);
    setUnparsed([]);
    if (!pasteText.trim()) {
      setPasteMsg('Paste the exam questions first.');
      return;
    }
    setPasteBusy(true);
    try {
      const r = await apiFetch<{ questions: any[]; unparsed?: any[]; method: string }>('/api/ai-detect', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({ mode: 'arrange', pasted_text: pasteText }),
      });
      setArranged(r.questions || []);
      setUnparsed(r.unparsed || []);
      const skipped = (r.unparsed || []).length;
      setPasteMsg(
        `AI arranged ${r.questions?.length || 0} question(s) with answers — review each number below, then save.` +
        (skipped ? ` ${skipped} block(s) could not be parsed — see the skipped list.` : '')
      );
    } catch (e: any) {
      setPasteMsg(e.message || 'AI arrangement failed.');
    } finally {
      setPasteBusy(false);
    }
  };

  const saveArranged = async () => {
    setPasteMsg('');
    if (!quizId) {
      setPasteMsg('Select a quiz first.');
      return;
    }
    if (!arranged.length) {
      setPasteMsg('Nothing to save — arrange the pasted text first.');
      return;
    }
    setPasteBusy(true);
    try {
      const rows = arranged.map((q: any) => ({
        quiz_id: Number(quizId),
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c || '',
        option_d: q.option_d || '',
        correct_option: q.detected_answer,
        marks: 1,
      }));
      await apiFetch('/api/questions', { method: 'POST', admin: true, body: JSON.stringify({ questions: rows }) });
      setPasteMsg(`Saved ${rows.length} question(s) to the quiz!`);
      setPasteText('');
      setArranged([]);
      fetchQuestions();
    } catch (e: any) {
      setPasteMsg(e.message || 'Save failed.');
    } finally {
      setPasteBusy(false);
    }
  };

  const bulkImport = async () => {
    setBulkMsg('');
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    // Format per line: Question | A | B | C | D | CORRECT(A-D) | marks
    const rows: any[] = [];
    for (const line of lines) {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length < 6) continue;
      const [qt, a, b, c, d, correct, marks] = parts;
      if (!qt || !a || !b) continue;
      rows.push({ quiz_id: Number(quizId), question_text: qt, option_a: a, option_b: b, option_c: c || '', option_d: d || '', correct_option: (correct || 'A').toUpperCase(), marks: Number(marks) || 1 });
    }
    if (!rows.length) {
      setBulkMsg('No valid lines found. Use: Question | A | B | C | D | CORRECT | marks');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/api/questions', { method: 'POST', admin: true, body: JSON.stringify({ questions: rows }) });
      setBulkMsg(`Imported ${rows.length} questions successfully!`);
      setBulkText('');
      fetchQuestions();
    } catch (e: any) {
      setBulkMsg(e.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900">Question Bank</h1>
          <p className="text-sm text-gray-500">Add and manage exam questions with correct answers.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setPasteOpen(true); setPasteMsg(''); setArranged([]); setUnparsed([]); }} disabled={!quizId} className="gold-btn font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50">
            <Sparkles className="w-4 h-4" /> Paste & AI Arrange
          </button>
          <button onClick={() => setBulkOpen(true)} className="border border-navy-100 bg-white hover:border-gold-400 font-bold text-sm px-4 py-2.5 rounded-xl text-navy-900">
            Bulk Import
          </button>
          <button onClick={openNew} disabled={!quizId} className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add Question
          </button>
        </div>
      </div>

      <div className="max-w-md">
        <label className="label-text">Select Quiz</label>
        <select className="input-field" value={quizId} onChange={(e) => setQuizId(e.target.value)}>
          <option value="">— Choose a quiz —</option>
          {quizzes.map((q) => (
            <option key={q.id} value={q.id}>{q.title} ({formatCategory(q.level)})</option>
          ))}
        </select>
      </div>

      {!quizId ? (
        <EmptyState title="Select a quiz" message="Choose a quiz above to manage its questions." />
      ) : loading ? (
        <Spinner label="Loading questions…" />
      ) : questions.length === 0 ? (
        <EmptyState title="No questions yet" message="Add questions one by one or use bulk import." action={<button onClick={openNew} className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl">Add Question</button>} />
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-2xl border border-navy-100 p-5">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 shrink-0 rounded-lg bg-navy-900 text-gold-300 font-extrabold text-sm flex items-center justify-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-navy-900">{q.question_text}</p>
                  <div className="grid sm:grid-cols-2 gap-2 mt-3">
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                      const val = q[`option_${opt.toLowerCase()}`];
                      if (!val) return null;
                      const correct = q.correct_option === opt;
                      return (
                        <div key={opt} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${correct ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-navy-50 text-gray-600'}`}>
                          <span className="font-extrabold">{opt}.</span> <span className="truncate">{val}</span>
                          {correct && <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-2">{q.marks} mark{q.marks === 1 ? '' : 's'}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(q)} className="p-2 rounded-lg bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800 transition"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(q.id)} className="p-2 rounded-lg bg-red-50 hover:bg-red-600 hover:text-white text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Question' : 'Add Question'} wide>
        <form onSubmit={save} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div>
            <label className="label-text">Question *</label>
            <textarea className="input-field" rows={2} value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} placeholder="Type the question…" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {(['a', 'b', 'c', 'd'] as const).map((o) => (
              <div key={o}>
                <label className="label-text">Option {o.toUpperCase()}{o === 'a' || o === 'b' ? ' *' : ''}</label>
                <input className="input-field" value={form[`option_${o}`]} onChange={(e) => setForm({ ...form, [`option_${o}`]: e.target.value })} placeholder={`Option ${o.toUpperCase()}`} />
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label-text">Correct Option *</label>
              <select className="input-field" value={form.correct_option} onChange={(e) => setForm({ ...form, correct_option: e.target.value })}>
                <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
              </select>
            </div>
            <div>
              <label className="label-text">Marks</label>
              <input type="number" min="1" className="input-field" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={detectAnswer}
              disabled={aiBusy}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gold-500/60 hover:border-gold-500 bg-gold-50 font-bold text-sm py-3 rounded-xl text-navy-900 transition disabled:opacity-60"
            >
              {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-gold-600" />}
              {aiBusy ? 'AI is detecting the answer…' : 'Detect Answer with AI'}
            </button>
            {aiResult && (
              <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm">
                <div className="font-extrabold text-emerald-800">
                  AI suggests option {aiResult.answer} <span className="font-semibold text-emerald-600">({Math.round(aiResult.confidence * 100)}% confidence)</span>
                </div>
                <div className="text-xs text-emerald-700 mt-1">{aiResult.explanation}</div>
                <div className="text-[11px] text-gray-400 mt-1">The correct-option field above was set to {aiResult.answer} — review it, then finalize.</div>
              </div>
            )}
          </div>
          <button type="submit" disabled={busy} className="w-full gold-btn font-bold py-3 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {busy ? 'Saving…' : 'Save Question'}
          </button>
        </form>
      </Modal>

      <Modal open={pasteOpen} onClose={() => setPasteOpen(false)} title="Paste Questions — AI Arranges Answers" wide>
        <div className="space-y-4">
          <div className="bg-navy-50 border border-navy-100 rounded-xl p-4 text-xs text-gray-600">
            <div className="font-bold text-navy-900 mb-1">Paste raw exam text — AI numbers each question and arranges the answer</div>
            <code className="block bg-white rounded-lg p-2.5 font-mono text-[11px] overflow-x-auto whitespace-pre-line">
              1. What is 2+2? A) 3 B) 4 C) 5 D) 6 Answer: B
              2) Capital of Nigeria? (a) Lagos (b) Abuja (c) Kano (d) Ibadan — Ans: b
            </code>
            <div className="mt-1">Works with A) B) C) D), A. B. C. D., (a)(b)(c)(d), numbered options, or Question | A | B | C | D | ANSWER lines. Inline keys (Answer:/Ans:/✓) and a trailing "Answer Key" section (1-B 2.C …) are honoured per number; otherwise AI solves each number.</div>
          </div>
          <textarea className="input-field font-mono text-xs" rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste the full exam text here…" />
          {pasteMsg && <div className="text-sm font-semibold text-navy-800 bg-gold-50 border border-gold-400/40 rounded-xl px-4 py-3">{pasteMsg}</div>}
          <button onClick={arrangePasted} disabled={pasteBusy} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gold-500/60 hover:border-gold-500 bg-gold-50 font-bold text-sm py-3 rounded-xl text-navy-900 transition disabled:opacity-60">
            {pasteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-gold-600" />}
            {pasteBusy ? 'AI is arranging…' : 'Arrange with AI'}
          </button>
          {arranged.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto scroll-thin border border-navy-100 rounded-xl p-3 bg-white">
              {arranged.map((q: any) => (
                <div key={q.number} className="flex items-start gap-3 bg-navy-50 rounded-xl px-3 py-2.5">
                  <span className="w-7 h-7 shrink-0 rounded-lg bg-navy-900 text-gold-300 font-extrabold text-xs flex items-center justify-center">{q.number}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-navy-900 line-clamp-2">{q.question_text}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">A) {q.option_a} · B) {q.option_b}{q.option_c ? ` · C) ${q.option_c}` : ''}{q.option_d ? ` · D) ${q.option_d}` : ''}</p>
                    {q.explanation && <p className="text-[10px] text-emerald-700 mt-0.5 truncate">{q.explanation}</p>}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <select
                      className="input-field !py-1 !px-2 !text-xs font-extrabold w-16"
                      value={q.detected_answer}
                      onChange={(e) => setArranged((prev) => prev.map((x) => (x.number === q.number ? { ...x, detected_answer: e.target.value } : x)))}
                      title="Correct answer — change if needed"
                    >
                      <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                    </select>
                    <span className="badge bg-emerald-100 text-emerald-700 !text-[10px]">{Math.round((q.confidence || 0) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {unparsed.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs">
              <div className="font-bold text-red-700 mb-1">Skipped {unparsed.length} block(s) — add options A–D or fix numbering, then re-arrange:</div>
              <ul className="space-y-1 text-red-600">
                {unparsed.slice(0, 8).map((u: any) => (
                  <li key={u.number} className="truncate">#{u.number}: {u.preview}…</li>
                ))}
              </ul>
            </div>
          )}
          {arranged.length > 0 && (
            <button onClick={saveArranged} disabled={pasteBusy || !quizId} className="w-full gold-btn font-bold py-3 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {pasteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save {arranged.length} Arranged Question(s)
            </button>
          )}
        </div>
      </Modal>

      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk Import Questions" wide>
        <div className="space-y-4">
          <div className="bg-navy-50 border border-navy-100 rounded-xl p-4 text-xs text-gray-600">
            <div className="font-bold text-navy-900 mb-1">One question per line, fields separated by |</div>
            <code className="block bg-white rounded-lg p-2.5 font-mono text-[11px] overflow-x-auto">
              What is 2+2? | 3 | 4 | 5 | 6 | B | 1
            </code>
            <div className="mt-1">Format: Question | A | B | C | D | CORRECT(A–D) | marks</div>
          </div>
          <textarea className="input-field font-mono text-xs" rows={8} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="Paste questions here, one per line…" />
          {bulkMsg && <div className="text-sm font-semibold text-navy-800 bg-gold-50 border border-gold-400/40 rounded-xl px-4 py-3">{bulkMsg}</div>}
          <button onClick={bulkImport} disabled={busy || !quizId} className="w-full gold-btn font-bold py-3 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Import Questions
          </button>
        </div>
      </Modal>
    </div>
  );
}
