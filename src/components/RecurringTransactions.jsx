import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { useGroup } from "../contexts/GroupContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { fromDbRecurring, toDbRecurring } from "../lib/mappers";

const RecurringTransactions = () => {
  const { user } = useAuth();
  const { activeGroup } = useGroup();
  const { symbol, formatCurrency } = useCurrency();
  const [recurring, setRecurring] = useState([]);
  const [isAddingRecurring, setIsAddingRecurring] = useState(false);
  const [formData, setFormData] = useState({
    description: "", amount: "", type: "expense",
    frequency: "monthly", dayOfMonth: "1", categoryId: "",
  });

  useEffect(() => {
    if (!user) return;
    let query = supabase.from("recurring_transactions").select("*").eq("user_id", user.id);
    query = activeGroup ? query.eq("group_id", activeGroup.id) : query.is("group_id", null);
    query.then(({ data, error }) => { if (!error) setRecurring((data || []).map(fromDbRecurring)); });
  }, [user, activeGroup]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newRecurring = {
      description: formData.description,
      amount: parseFloat(formData.amount),
      type: formData.type,
      frequency: formData.frequency,
      dayOfMonth: parseInt(formData.dayOfMonth),
      categoryId: formData.type === "expense" ? parseInt(formData.categoryId) || null : null,
      active: true,
    };

    const { data, error } = await supabase
      .from("recurring_transactions")
      .insert(toDbRecurring(newRecurring, user.id, activeGroup?.id ?? null))
      .select()
      .single();

    if (!error) setRecurring(prev => [...prev, fromDbRecurring(data)]);

    setFormData({ description: "", amount: "", type: "expense", frequency: "monthly", dayOfMonth: "1", categoryId: "" });
    setIsAddingRecurring(false);
  };

  const handleToggle = async (id) => {
    const item = recurring.find(r => r.id === id);
    const { error } = await supabase
      .from("recurring_transactions")
      .update({ active: !item.active })
      .eq("id", id)
      .eq("user_id", user.id);
    if (!error) setRecurring(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar transação recorrente?")) return;
    const { error } = await supabase
      .from("recurring_transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (!error) setRecurring(prev => prev.filter(r => r.id !== id));
  };

  const getFrequencyText = (frequency) => {
    const map = { weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal", yearly: "Anual" };
    return map[frequency] || frequency;
  };

  return (
    <div className="recurring-section">
      <div className="section-header">
        <div>
          <h3 className="section-title">Transações Recorrentes</h3>
          <p style={{ fontSize: '13px', color: 'var(--beige-700)', marginTop: '4px' }}>
            Subscrições, renda, salário...
          </p>
        </div>
        {!isAddingRecurring && (
          <button onClick={() => setIsAddingRecurring(true)} className="btn btn-primary btn-small">
            + Nova Recorrente
          </button>
        )}
      </div>

      {isAddingRecurring && (
        <div className="card fade-in" style={{ marginBottom: '24px' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button type="button" onClick={() => setFormData({ ...formData, type: "expense" })}
                className={formData.type === "expense" ? "btn btn-warning" : "btn btn-secondary"} style={{ flex: 1 }}>
                Despesa
              </button>
              <button type="button" onClick={() => setFormData({ ...formData, type: "income" })}
                className={formData.type === "income" ? "btn btn-success" : "btn btn-secondary"} style={{ flex: 1 }}>
                Receita
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input type="text" placeholder="Ex: Netflix, Salário, Renda..."
                value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-input" required autoFocus />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Valor ({symbol})</label>
                <input type="number" placeholder="0.00" value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="form-input" step="0.01" min="0.01" required />
              </div>
              <div className="form-group">
                <label className="form-label">Frequência</label>
                <select value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })} className="form-select">
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="monthly">Mensal</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Dia do Mês</label>
              <input type="number" value={formData.dayOfMonth}
                onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })}
                className="form-input" min="1" max="31" required />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Criar</button>
              <button type="button" onClick={() => setIsAddingRecurring(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {recurring.length === 0 && !isAddingRecurring ? (
        <div className="empty-state">
          <div className="empty-icon">🔄</div>
          <div className="empty-title">Nenhuma transação recorrente</div>
          <div className="empty-description">Adicione despesas/receitas que se repetem regularmente</div>
        </div>
      ) : (
        <div className="recurring-list">
          {recurring.map(item => (
            <div key={item.id} className="recurring-item">
              <div className="recurring-toggle">
                <input type="checkbox" checked={item.active} onChange={() => handleToggle(item.id)} className="form-checkbox" />
              </div>
              <div className="recurring-icon" style={{
                background: item.type === "income" ? 'rgba(107, 155, 107, 0.15)' : 'rgba(212, 165, 116, 0.15)',
                opacity: item.active ? 1 : 0.4,
              }}>
                {item.type === "income" ? '💰' : '🔄'}
              </div>
              <div className="recurring-info" style={{ opacity: item.active ? 1 : 0.6 }}>
                <div className="recurring-description">{item.description}</div>
                <div className="recurring-meta">{getFrequencyText(item.frequency)} • Dia {item.dayOfMonth}</div>
              </div>
              <div className="recurring-amount" style={{
                color: item.type === "income" ? 'var(--success)' : 'var(--warning)',
                opacity: item.active ? 1 : 0.6,
              }}>
                {formatCurrency(item.type === "income" ? item.amount : -item.amount, { decimals: 2, showSign: true })}
              </div>
              <button onClick={() => handleDelete(item.id)} className="recurring-delete">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurringTransactions;