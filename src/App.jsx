import { useState, useEffect, useContext } from "react";
import TransactionList from "./components/TransactionList";
import Header from "./components/Header";
import MonthPicker from "./components/MonthPicker";
import Dashboard from "./components/Dashboard";
import CategoryManager from "./components/CategoryManager";
import MonthInsights from "./components/MonthInsights";
import SavingsGoals from "./components/SavingsGoals";
import ExportData from "./components/ExportData";
import RecurringTransactions from "./components/RecurringTransactions";
import BudgetAlerts from "./components/BudgetAlerts";
import AnalysisView from "./components/AnalysisView";
import AnnualView from "./components/AnnualView";
import ActivitiesManager from "./components/ActivitiesManager";
import FuelTracker from "./components/FuelTracker";
import Auth, { EmailConfirmationPending } from "./components/Auth";
import useRecurringInjector from "./hooks/useRecurringInjector";
import { CategoriesContext, CategoriesProvider } from "./contexts/CategoriesContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { GroupProvider, useGroup } from "./contexts/GroupContext";
import Account from "./components/Account";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { supabase } from "./lib/supabaseClient";
import { fromDbTransaction, toDbTransaction } from "./lib/mappers";

const AppWrapper = () => (
  <AuthProvider>
    <AuthGate />
  </AuthProvider>
);

const AuthGate = () => {
  const { user, loading, signOut, resendConfirmation } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--beige-700)" }}>
        A carregar...
      </div>
    );
  }

  if (!user) return <Auth />;

  // Conta autenticada mas email ainda por confirmar: bloqueia o acesso à app
  const emailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
  if (!emailConfirmed) {
    return (
      <EmailConfirmationPending
        email={user.email}
        onResend={resendConfirmation}
        onSignOut={signOut}
      />
    );
  }

  return (
    <GroupProvider>
      <CategoriesProvider>
        <CurrencyProvider>
          <App />
        </CurrencyProvider>
      </CategoriesProvider>
    </GroupProvider>
  );
};

function App() {
  const { user, signOut } = useAuth();
  const { activeGroup } = useGroup();
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [view, setView] = useState("dashboard");
  const [viewMode, setViewMode] = useState("month");
  const [selectedDate, setSelectedDate] = useState({
    month: new Date().getMonth(), year: new Date().getFullYear(),
  });

  useRecurringInjector(transactions, setTransactions);

  useEffect(() => {
    if (!user) return;
    setLoadingTx(true);
    let query = supabase.from("transactions").select("*").eq("user_id", user.id);
    query = activeGroup ? query.eq("group_id", activeGroup.id) : query.is("group_id", null);
    query.then(({ data, error }) => {
      if (!error) setTransactions((data || []).map(fromDbTransaction));
      setLoadingTx(false);
    });
  }, [user, activeGroup]);

  const { categories } = useContext(CategoriesContext);

  const handleAddTransaction = async (t) => {
    const { data, error } = await supabase
      .from("transactions")
      .insert(toDbTransaction(t, user.id, activeGroup?.id ?? null, t.activityId ?? null))
      .select()
      .single();
    if (error) { console.error(error); return; }
    setTransactions(prev => [...prev, fromDbTransaction(data)]);
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm("Eliminar esta transação?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id);
    if (error) { console.error(error); return; }
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleEditTransaction = async (id, d) => {
    const { error } = await supabase
      .from("transactions")
      .update({
        description: d.description,
        amount: d.amount,
        type: d.type,
        category_id: d.categoryId ?? null,
        date: new Date(d.date).toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) { console.error(error); return; }
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...d } : t));
  };

  const filteredTransactions = transactions.filter(t => {
    const d = new Date(t.date || Date.now());
    return d.getMonth() === selectedDate.month && d.getFullYear() === selectedDate.year;
  });

  if (loadingTx) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--beige-700)" }}>
        A carregar os teus dados...
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header view={view} setView={setView} userEmail={user?.email} />
      <div className="content-wrapper">

        {view === "dashboard" && (
          <>
            <MonthPicker selectedDate={selectedDate} onDateChange={setSelectedDate}
              viewMode={viewMode} onViewModeChange={setViewMode} />
            {viewMode === "month" ? (
              <>
                <Dashboard transactions={filteredTransactions} />
                <BudgetAlerts transactions={filteredTransactions} categories={categories} />
                <MonthInsights transactions={filteredTransactions} selectedDate={selectedDate} />
              </>
            ) : (
              <AnnualView allTransactions={transactions} selectedYear={selectedDate.year} compact={true} />
            )}
          </>
        )}

        {view === "transactions" && (
          <TransactionList transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={handleEditTransaction} />
        )}

        {view === "analysis" && (
          <>
            <AnalysisView transactions={transactions} categories={categories}
              selectedDate={selectedDate} onDateChange={setSelectedDate}
              viewMode={viewMode} onViewModeChange={setViewMode} />
            <ExportData transactions={transactions} categories={categories} />
          </>
        )}

        {view === "goals" && <SavingsGoals />}

        {view === "categories" && (
          <>
            <CategoryManager />
            <RecurringTransactions />
          </>
        )}

        {view === "activities" && <ActivitiesManager transactions={transactions} />}

        {view === "fuel" && (
          <FuelTracker
            categories={categories}
            onTransactionCreated={(tx) => setTransactions(prev => [...prev, tx])}
            onTransactionDeleted={(id) => setTransactions(prev => prev.filter(t => t.id !== id))}
          />
        )}

        {view === "account" && (
          <Account
            user={user}
            onSignOut={signOut}
            transactions={transactions}
            categories={categories}
            stats={{
              transactionsCount: transactions.length,
              categoriesCount: categories.length,
            }}
          />
        )}
      </div>
    </div>
  );
}

export default AppWrapper;