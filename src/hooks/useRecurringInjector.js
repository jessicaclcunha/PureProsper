import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { fromDbTransaction } from "../lib/mappers";

const useRecurringInjector = (transactions, setTransactions, groupId = null) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      let query = supabase
        .from("recurring_transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true);
      query = groupId ? query.eq("group_id", groupId) : query.is("group_id", null);

      const { data: recurring, error } = await query;

      if (error || !recurring || recurring.length === 0) return;

      const now = new Date();
      const rowsToInsert = [];

      recurring.forEach(r => {
        const occurrences = getOccurrencesSince(r, now);
        occurrences.forEach(date => {
          const key = `recurring_${r.id}_${date.getFullYear()}_${date.getMonth()}_${date.getDate()}`;
          const alreadyExists = transactions.some(t => t.recurringKey === key);
          if (!alreadyExists) {
            rowsToInsert.push({
              user_id: user.id,
              group_id: groupId ?? null,
              category_id: r.category_id,
              description: r.description,
              amount: r.amount,
              type: r.type,
              date: date.toISOString(),
              is_recurring: true,
              recurring_key: key,
              recurring_id: r.id,
            });
          }
        });
      });

      if (rowsToInsert.length === 0) return;

      const { data: inserted, error: insertError } = await supabase
        .from("transactions")
        .insert(rowsToInsert)
        .select();

      if (insertError) { console.error(insertError); return; }

      setTransactions(prev => [...prev, ...inserted.map(fromDbTransaction)]);
    };

    run();
    // Só corre quando o utilizador ou o grupo ativo mudam / no mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, groupId]);
};

function getOccurrencesSince(recurring, now) {
  const createdAt = new Date(recurring.created_at);
  const occurrences = [];

  const startYear = createdAt.getFullYear();
  const startMonth = createdAt.getMonth();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth();

  if (recurring.frequency === "yearly") {
    for (let y = startYear; y <= endYear; y++) {
      const d = new Date(y, createdAt.getMonth(), recurring.day_of_month);
      if (d >= createdAt && d <= now) occurrences.push(d);
    }
    return occurrences;
  }

  if (recurring.frequency === "weekly" || recurring.frequency === "biweekly") {
    const step = recurring.frequency === "weekly" ? 7 : 14;
    const d = new Date(createdAt);
    while (d <= now) {
      const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (target >= createdAt && target <= now) occurrences.push(new Date(target));
      d.setDate(d.getDate() + step);
    }
    return occurrences;
  }

  // monthly (default)
  for (
    let y = startYear, m = startMonth;
    y < endYear || (y === endYear && m <= endMonth);
    m === 11 ? (y++, m = 0) : m++
  ) {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const day = Math.min(recurring.day_of_month, daysInMonth);
    const d = new Date(y, m, day);
    if (d >= createdAt && d <= now) occurrences.push(d);
  }

  return occurrences;
}

export default useRecurringInjector;