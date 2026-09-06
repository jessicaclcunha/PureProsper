import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { useGroup } from "../contexts/GroupContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { fromDbActivity, toDbActivity } from "../lib/groupMappers";

// transactions: já filtradas para o grupo ativo (vem de App.jsx), sem filtro de mês —
// para os totais de cada atividade contarem a vida toda da atividade.
const ActivitiesManager = ({ transactions }) => {
  const { user } = useAuth();
  const { activeGroup } = useGroup();
  const { formatCurrency } = useCurrency();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", date: "", participantsCount: "", notes: "" });

  useEffect(() => {
    if (!activeGroup) { setActivities([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from("activities")
      .select("*")
      .eq("group_id", activeGroup.id)
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setActivities((data || []).map(fromDbActivity));
        setLoading(false);
      });
  }, [activeGroup, user]);

  const resetForm = () => {
    setForm({ name: "", date: "", participantsCount: "", notes: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      date: form.date || null,
      participantsCount: form.participantsCount ? parseInt(form.participantsCount) : null,
      notes: form.notes || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("activities")
        .update({
          name: payload.name,
          activity_date: payload.date,
          participants_count: payload.participantsCount,
          notes: payload.notes,
        })
        .eq("id", editingId)
        .eq("user_id", user.id);
      if (!error) setActivities(prev => prev.map(a => a.id === editingId ? { ...a, ...payload } : a));
    } else {
      const { data, error } = await supabase
        .from("activities")
        .insert(toDbActivity(payload, activeGroup.id, user.id))
        .select()
        .single();
      if (!error) setActivities(prev => [fromDbActivity(data), ...prev]);
    }
    resetForm();
  };

  const handleEdit = (a) => {
    setForm({
      name: a.name,
      date: a.date || "",
      participantsCount: a.participantsCount || "",
      notes: a.notes || "",
    });
    setEditingId(a.id);
    setIsAdding(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar esta atividade? As transações associadas mantêm-se, mas ficam sem atividade.")) return;
    const { error } = await supabase.from("activities").delete().eq("id", id).eq("user_id", user.id);
    if (!error) setActivities(prev => prev.filter(a => a.id !== id));
  };

  const getActivityTotals = (activityId) => {
    const tx = transactions.filter(t => t.activityId === activityId);
    const income = tx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = tx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expenses, balance: income - expenses, count: tx.length };
  };

  if (!activeGroup) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🏷️</div>
        <div className="empty-title">Sem conta de grupo ativa</div>
        <div className="empty-description">Escolhe ou cria uma conta de grupo no menu do topo para veres atividades.</div>
      </div>
    );
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">Atividades — {activeGroup.name}</h2>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="btn btn-primary">+ Nova Atividade</button>
        )}
      </div>

      {isAdding && (
        <div className="card fade-in" style={{ marginBottom: "20px" }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="form-input"
                placeholder="Ex: Sunset, Parque Aquático, Missa Geraz..."
                required
                autoFocus
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Data</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nº de participantes</label>
                <input
                  type="number"
                  min="0"
                  value={form.participantsCount}
                  onChange={e => setForm({ ...form, participantsCount: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas (opcional)</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="form-input"
              />
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                {editingId ? "Guardar" : "Criar"}
              </button>
              <button type="button" onClick={resetForm} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="empty-description">A carregar atividades...</div></div>
      ) : activities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎈</div>
          <div className="empty-title">Nenhuma atividade</div>
          <div className="empty-description">Cria a primeira atividade deste grupo.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {activities.map(a => {
            const totals = getActivityTotals(a.id);
            return (
              <div key={a.id} className="activity-card">
                <div className="activity-card-header">
                  <div>
                    <div className="activity-name">{a.name}</div>
                    <div className="activity-meta">
                      {a.date
                        ? new Date(a.date).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })
                        : "Sem data"}
                      {a.participantsCount ? ` · ${a.participantsCount} participantes` : ""}
                      {` · ${totals.count} transaç${totals.count === 1 ? "ão" : "ões"}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button onClick={() => handleEdit(a)} className="goal-edit" title="Editar">✎</button>
                    <button onClick={() => handleDelete(a.id)} className="goal-delete" title="Eliminar">×</button>
                  </div>
                </div>

                <div className="activity-balance-row">
                  <div className="activity-balance-item">
                    <div className="activity-balance-label">Angariações</div>
                    <div className="activity-balance-value" style={{ color: "var(--success)" }}>
                      {formatCurrency(totals.income, { decimals: 0 })}
                    </div>
                  </div>
                  <div className="activity-balance-item">
                    <div className="activity-balance-label">Despesas</div>
                    <div className="activity-balance-value" style={{ color: "var(--warning)" }}>
                      {formatCurrency(totals.expenses, { decimals: 0 })}
                    </div>
                  </div>
                  <div className="activity-balance-item">
                    <div className="activity-balance-label">Saldo</div>
                    <div
                      className="activity-balance-value"
                      style={{ color: totals.balance >= 0 ? "var(--success)" : "var(--error)" }}
                    >
                      {formatCurrency(totals.balance, { decimals: 0, showSign: true })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ActivitiesManager;