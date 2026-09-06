import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { useGroup } from "../contexts/GroupContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { fromDbFuelTrip, toDbFuelTrip, fromDbActivity } from "../lib/groupMappers";
import { fromDbTransaction } from "../lib/mappers";

const MONTHS_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// categories: categorias do grupo ativo (para encontrar a categoria "Gasóleo" e ligar a despesa)
// onTransactionCreated / onTransactionDeleted: mantêm o estado de transactions em App.jsx sincronizado
// sem precisar de recarregar tudo da base de dados.
const FuelTracker = ({ categories = [], onTransactionCreated, onTransactionDeleted }) => {
  const { user } = useAuth();
  const { activeGroup } = useGroup();
  const { symbol, formatCurrency } = useCurrency();

  const [trips, setTrips] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [form, setForm] = useState({
    driverName: "",
    date: new Date().toISOString().split("T")[0],
    km: "",
    manualAmount: "",
    activityId: "",
  });

  const rate = activeGroup?.fuelRatePerKm ?? 0.36;
  const fuelCategory = categories.find(c => {
    const n = (c.name || "").toLowerCase();
    return n.includes("gasóleo") || n.includes("gasoleo") || n.includes("combustível") || n.includes("combustivel");
  });

  useEffect(() => {
    if (!activeGroup) { setTrips([]); setActivities([]); setLoading(false); return; }
    setLoading(true);

    Promise.all([
      supabase.from("fuel_trips").select("*")
        .eq("group_id", activeGroup.id).eq("user_id", user.id)
        .order("trip_date", { ascending: false }),
      supabase.from("activities").select("*")
        .eq("group_id", activeGroup.id).eq("user_id", user.id)
        .order("activity_date", { ascending: false }),
    ]).then(([tripsRes, actsRes]) => {
      if (!tripsRes.error) setTrips((tripsRes.data || []).map(fromDbFuelTrip));
      if (!actsRes.error) setActivities((actsRes.data || []).map(fromDbActivity));
      setLoading(false);
    });
  }, [activeGroup, user]);

  const knownDrivers = [...new Set(trips.map(t => t.driverName))].sort();

  const resetForm = () => {
    setForm({ driverName: "", date: new Date().toISOString().split("T")[0], km: "", manualAmount: "", activityId: "" });
    setIsManual(false);
    setIsAdding(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.driverName.trim()) return;

    const tripInput = {
      driverName: form.driverName.trim(),
      date: form.date,
      activityId: form.activityId ? parseInt(form.activityId) : null,
      isManual,
      km: isManual ? null : parseFloat(form.km) || 0,
      rateUsed: isManual ? null : rate,
      manualAmount: isManual ? parseFloat(form.manualAmount) || 0 : null,
    };

    const { data: tripRow, error: tripError } = await supabase
      .from("fuel_trips")
      .insert(toDbFuelTrip(tripInput, activeGroup.id, user.id))
      .select()
      .single();

    if (tripError) { console.error(tripError); return; }

    const activity = activities.find(a => a.id === tripInput.activityId);
    const description = `Gasóleo - ${tripInput.driverName}${activity ? ` (${activity.name})` : ""}`;

    const { data: txRow, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        group_id: activeGroup.id,
        activity_id: tripInput.activityId,
        category_id: fuelCategory?.id ?? null,
        description,
        amount: tripRow.amount,
        type: "expense",
        date: new Date(form.date).toISOString(),
      })
      .select()
      .single();

    let transactionId = null;
    if (!txError) {
      transactionId = txRow.id;
      await supabase.from("fuel_trips").update({ transaction_id: txRow.id }).eq("id", tripRow.id);
      onTransactionCreated?.(fromDbTransaction(txRow));
    } else {
      console.error(txError);
    }

    setTrips(prev => [{ ...fromDbFuelTrip(tripRow), transactionId }, ...prev]);
    resetForm();
  };

  const handleDelete = async (trip) => {
    if (!window.confirm("Eliminar este registo de gasóleo? A despesa associada também será removida.")) return;
    await supabase.from("fuel_trips").delete().eq("id", trip.id).eq("user_id", user.id);
    if (trip.transactionId) {
      await supabase.from("transactions").delete().eq("id", trip.transactionId).eq("user_id", user.id);
      onTransactionDeleted?.(trip.transactionId);
    }
    setTrips(prev => prev.filter(t => t.id !== trip.id));
  };

  // Resumo condutor x mês — como na folha original
  const summary = {};
  trips.forEach(t => {
    const month = new Date(t.date).getMonth();
    if (!summary[t.driverName]) summary[t.driverName] = Array(12).fill(0);
    summary[t.driverName][month] += t.amount;
  });
  const drivers = Object.keys(summary).sort();
  const monthlyTotals = Array(12).fill(0);
  drivers.forEach(d => summary[d].forEach((v, i) => { monthlyTotals[i] += v; }));
  const grandTotal = trips.reduce((s, t) => s + t.amount, 0);
  const totalKm = trips.reduce((s, t) => s + (t.km || 0), 0);

  if (!activeGroup) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⛽</div>
        <div className="empty-title">Sem conta de grupo ativa</div>
        <div className="empty-description">Escolhe ou cria uma conta de grupo no menu do topo.</div>
      </div>
    );
  }

  return (
    <section className="section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Gasóleo</h2>
          <p style={{ fontSize: "13px", color: "var(--beige-700)", marginTop: "4px" }}>
            Taxa atual: {formatCurrency(rate, { decimals: 2 })}/km
          </p>
        </div>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="btn btn-primary">+ Registar Viagem</button>
        )}
      </div>

      {isAdding && (
        <div className="card fade-in" style={{ marginBottom: "20px" }}>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Condutor</label>
                <input
                  type="text"
                  list="known-drivers"
                  value={form.driverName}
                  onChange={e => setForm({ ...form, driverName: e.target.value })}
                  className="form-input"
                  placeholder="Nome"
                  required
                  autoFocus
                />
                <datalist id="known-drivers">
                  {knownDrivers.map(d => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
            </div>

            {activities.length > 0 && (
              <div className="form-group">
                <label className="form-label">Atividade (opcional)</label>
                <select
                  value={form.activityId}
                  onChange={e => setForm({ ...form, activityId: e.target.value })}
                  className="form-select"
                >
                  <option value="">Sem atividade associada</option>
                  {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

            <div className="view-mode-toggle" style={{ marginBottom: "16px" }}>
              <button type="button" onClick={() => setIsManual(false)} className={!isManual ? "view-btn active" : "view-btn"}>
                Km × taxa
              </button>
              <button type="button" onClick={() => setIsManual(true)} className={isManual ? "view-btn active" : "view-btn"}>
                Valor manual
              </button>
            </div>

            {!isManual ? (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Quilómetros</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.km}
                    onChange={e => setForm({ ...form, km: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Valor estimado</label>
                  <input
                    type="text"
                    disabled
                    className="form-input"
                    value={formatCurrency((parseFloat(form.km) || 0) * rate, { decimals: 2 })}
                  />
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Valor ({symbol})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.manualAmount}
                  onChange={e => setForm({ ...form, manualAmount: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Registar</button>
              <button type="button" onClick={resetForm} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {!loading && trips.length > 0 && (
        <div className="card" style={{ marginBottom: "20px", overflowX: "auto" }}>
          <h3 className="section-title" style={{ fontSize: "16px", marginBottom: "12px" }}>Resumo por condutor</h3>
          <table className="fuel-summary-table">
            <thead>
              <tr>
                <th>Condutor</th>
                {MONTHS_SHORT.map(m => <th key={m}>{m}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => {
                const rowTotal = summary[d].reduce((s, v) => s + v, 0);
                return (
                  <tr key={d}>
                    <td style={{ fontWeight: 600 }}>{d}</td>
                    {summary[d].map((v, i) => (
                      <td key={i}>{v > 0 ? formatCurrency(v, { decimals: 0 }) : "—"}</td>
                    ))}
                    <td style={{ fontWeight: 600 }}>{formatCurrency(rowTotal, { decimals: 0 })}</td>
                  </tr>
                );
              })}
              <tr style={{ background: "var(--beige-100)" }}>
                <td style={{ fontWeight: 700 }}>Total</td>
                {monthlyTotals.map((v, i) => (
                  <td key={i} style={{ fontWeight: 700 }}>{v > 0 ? formatCurrency(v, { decimals: 0 }) : "—"}</td>
                ))}
                <td style={{ fontWeight: 700 }}>{formatCurrency(grandTotal, { decimals: 0 })}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: "12px", color: "var(--beige-600)", marginTop: "10px" }}>
            {totalKm.toFixed(0)} km registados no total (viagens por valor manual não contam para os km).
          </p>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="empty-description">A carregar...</div></div>
      ) : trips.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⛽</div>
          <div className="empty-title">Nenhuma viagem registada</div>
          <div className="empty-description">Regista a primeira viagem de gasóleo deste grupo.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {trips.map(t => {
            const activity = activities.find(a => a.id === t.activityId);
            return (
              <div key={t.id} className="fuel-trip-item">
                <div className="fuel-driver-avatar">{t.driverName[0].toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: "14px" }}>{t.driverName}</div>
                  <div style={{ fontSize: "12px", color: "var(--beige-700)" }}>
                    {new Date(t.date).toLocaleDateString("pt-PT", { day: "numeric", month: "short" })}
                    {t.km != null ? ` · ${t.km} km` : " · valor manual"}
                    {activity ? ` · ${activity.name}` : ""}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}>
                  {formatCurrency(t.amount, { decimals: 2 })}
                </div>
                <button onClick={() => handleDelete(t)} className="recurring-delete">×</button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default FuelTracker;