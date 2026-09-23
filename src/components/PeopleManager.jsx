import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { useGroup } from "../contexts/GroupContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { fromDbMember, toDbMember, fromDbMemberPayment } from "../lib/groupMappers";

const MONTHS_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const PeopleManager = () => {
  const { user } = useAuth();
  const { activeGroup } = useGroup();
  const { symbol, formatCurrency } = useCurrency();

  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: "", monthlyFee: "" });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const now = new Date();
  const isCurrentYear = selectedYear === now.getFullYear();
  const currentMonth = now.getMonth();

  useEffect(() => {
    if (!activeGroup) { setMembers([]); setPayments([]); setLoading(false); return; }

    setLoading(true);
    Promise.all([
      supabase.from("group_members").select("*")
        .eq("group_id", activeGroup.id).eq("user_id", user.id).order("created_at"),
      supabase.from("member_payments").select("*")
        .eq("user_id", user.id).eq("year", selectedYear),
    ]).then(([membersRes, paymentsRes]) => {
      const memberRows = membersRes.data || [];
      if (!membersRes.error) setMembers(memberRows.map(fromDbMember));

      if (!paymentsRes.error) {
        const memberIds = new Set(memberRows.map(m => m.id));
        setPayments((paymentsRes.data || []).filter(p => memberIds.has(p.member_id)).map(fromDbMemberPayment));
      }
      setLoading(false);
    });
  }, [activeGroup, user, selectedYear]);

  const resetForm = () => {
    setFormData({ name: "", monthlyFee: "" });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { name: formData.name.trim(), monthlyFee: parseFloat(formData.monthlyFee) || 0, active: true };
    if (!payload.name) return;

    if (editingId) {
      const { error } = await supabase
        .from("group_members")
        .update({ name: payload.name, monthly_fee: payload.monthlyFee })
        .eq("id", editingId)
        .eq("user_id", user.id);
      if (!error) setMembers(prev => prev.map(m => m.id === editingId ? { ...m, ...payload } : m));
    } else {
      const { data, error } = await supabase
        .from("group_members")
        .insert(toDbMember(payload, activeGroup.id, user.id))
        .select()
        .single();
      if (!error) setMembers(prev => [...prev, fromDbMember(data)]);
    }
    resetForm();
  };

  const handleEdit = (m) => {
    setFormData({ name: m.name, monthlyFee: String(m.monthlyFee) });
    setEditingId(m.id);
    setIsAdding(true);
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Eliminar "${m.name}"? O histórico de mensalidades desta pessoa também será eliminado.`)) return;
    const { error } = await supabase.from("group_members").delete().eq("id", m.id).eq("user_id", user.id);
    if (!error) {
      setMembers(prev => prev.filter(x => x.id !== m.id));
      setPayments(prev => prev.filter(p => p.memberId !== m.id));
    }
  };

  const handleToggleActive = async (m) => {
    const { error } = await supabase
      .from("group_members")
      .update({ active: !m.active })
      .eq("id", m.id)
      .eq("user_id", user.id);
    if (!error) setMembers(prev => prev.map(x => x.id === m.id ? { ...x, active: !x.active } : x));
  };

  const handleTogglePayment = async (member, month) => {
    const existing = payments.find(p => p.memberId === member.id && p.month === month);
    if (existing) {
      const { error } = await supabase.from("member_payments").delete().eq("id", existing.id).eq("user_id", user.id);
      if (!error) setPayments(prev => prev.filter(p => p.id !== existing.id));
    } else {
      const { data, error } = await supabase
        .from("member_payments")
        .insert({ user_id: user.id, member_id: member.id, year: selectedYear, month, amount: member.monthlyFee })
        .select()
        .single();
      if (!error) setPayments(prev => [...prev, fromDbMemberPayment(data)]);
    }
  };

  const isPaid = (memberId, month) => payments.some(p => p.memberId === memberId && p.month === month);

  const totalPaidInYear = (memberId) =>
    payments.filter(p => p.memberId === memberId).reduce((s, p) => s + p.amount, 0);

  const activeMembers = members.filter(m => m.active);
  const totalExpectedThisMonth = activeMembers.reduce((s, m) => s + m.monthlyFee, 0);
  const totalPaidThisMonth = isCurrentYear
    ? payments.filter(p => p.month === currentMonth && activeMembers.some(m => m.id === p.memberId))
        .reduce((s, p) => s + p.amount, 0)
    : 0;
  const owingMembers = isCurrentYear
    ? activeMembers.filter(m => !isPaid(m.id, currentMonth))
    : [];

  if (!activeGroup) {
    return (
      <div className="empty-state">
        <div className="empty-icon">👥</div>
        <div className="empty-title">Sem conta de grupo ativa</div>
        <div className="empty-description">Escolhe ou cria uma conta de grupo no menu do topo para geres pessoas e mensalidades.</div>
      </div>
    );
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">Pessoas — {activeGroup.name}</h2>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="btn btn-primary">+ Nova Pessoa</button>
        )}
      </div>

      {isAdding && (
        <div className="card fade-in" style={{ marginBottom: "20px" }}>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="form-input"
                  placeholder="Nome da pessoa"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mensalidade ({symbol})</label>
                <input
                  type="number"
                  value={formData.monthlyFee}
                  onChange={e => setFormData({ ...formData, monthlyFee: e.target.value })}
                  className="form-input"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                {editingId ? "Guardar" : "Criar"}
              </button>
              <button type="button" onClick={resetForm} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Resumo do mês atual */}
      {isCurrentYear && activeMembers.length > 0 && (
        <div className="stats-compact" style={{ marginBottom: "20px" }}>
          <div className="stat-compact">
            <div className="stat-compact-header"><span className="stat-compact-label">Recebido este mês</span></div>
            <div className="stat-compact-value positive">{formatCurrency(totalPaidThisMonth, { decimals: 0 })}</div>
            <div className="stat-compact-detail">de {formatCurrency(totalExpectedThisMonth, { decimals: 0 })} esperado</div>
          </div>
          <div className="stat-compact">
            <div className="stat-compact-header"><span className="stat-compact-label">Em falta</span></div>
            <div className="stat-compact-value negative">{owingMembers.length}</div>
            <div className="stat-compact-detail">
              {owingMembers.length > 0 ? owingMembers.map(m => m.name).join(", ") : "Todos pagaram 🎉"}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="empty-description">A carregar...</div></div>
      ) : members.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <div className="empty-title">Nenhuma pessoa registada</div>
          <div className="empty-description">Adiciona as pessoas deste grupo para controlares mensalidades e gasóleo.</div>
        </div>
      ) : (
        <>
          {/* Lista de pessoas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
            {members.map(m => (
              <div key={m.id} className="recurring-item" style={{ opacity: m.active ? 1 : 0.5 }}>
                <div className="recurring-toggle">
                  <input
                    type="checkbox"
                    checked={m.active}
                    onChange={() => handleToggleActive(m)}
                    className="form-checkbox"
                    title={m.active ? "Ativa — desmarca para arquivar" : "Arquivada — marca para reativar"}
                  />
                </div>
                <div className="recurring-icon" style={{ background: "rgba(139,61,61,0.1)" }}>
                  {m.name[0].toUpperCase()}
                </div>
                <div className="recurring-info">
                  <div className="recurring-description">{m.name}</div>
                  <div className="recurring-meta">
                    {m.monthlyFee > 0 ? `${formatCurrency(m.monthlyFee, { decimals: 2 })}/mês` : "Sem mensalidade"}
                    {" · "}{formatCurrency(totalPaidInYear(m.id), { decimals: 0 })} pago em {selectedYear}
                  </div>
                </div>
                <button onClick={() => handleEdit(m)} className="goal-edit" title="Editar">✎</button>
                <button onClick={() => handleDelete(m)} className="recurring-delete" title="Eliminar">×</button>
              </div>
            ))}
          </div>

          {/* Grelha de mensalidades por ano */}
          <div className="card" style={{ overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 className="section-title" style={{ fontSize: "16px", margin: 0 }}>Mensalidades {selectedYear}</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setSelectedYear(y => y - 1)} className="nav-arrow" style={{ width: "32px", height: "32px", fontSize: "14px" }}>←</button>
                <button onClick={() => setSelectedYear(y => y + 1)} className="nav-arrow" style={{ width: "32px", height: "32px", fontSize: "14px" }}>→</button>
              </div>
            </div>

            <table className="annual-table">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  {MONTHS_SHORT.map((mo, i) => (
                    <th key={mo} style={{ textAlign: "center", color: isCurrentYear && i === currentMonth ? "var(--burgundy-700)" : undefined }}>
                      {mo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td className="month-name" style={{ whiteSpace: "nowrap" }}>{m.name}</td>
                    {MONTHS_SHORT.map((_, month) => {
                      const paid = isPaid(m.id, month);
                      return (
                        <td key={month} style={{ textAlign: "center" }}>
                          <button
                            onClick={() => handleTogglePayment(m, month)}
                            title={paid ? "Pago — clica para desmarcar" : "Por pagar — clica para marcar como pago"}
                            style={{
                              width: "26px", height: "26px", borderRadius: "6px",
                              border: `1px solid ${paid ? "var(--success)" : "var(--beige-300)"}`,
                              background: paid ? "var(--success)" : "white",
                              color: paid ? "white" : "var(--beige-400)",
                              cursor: "pointer", fontSize: "13px", lineHeight: 1,
                            }}
                          >
                            {paid ? "✓" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: "11px", color: "var(--beige-600)", marginTop: "10px" }}>
              Clica numa célula para marcar/desmarcar o pagamento da mensalidade desse mês.
            </p>
          </div>
        </>
      )}
    </section>
  );
};

export default PeopleManager;