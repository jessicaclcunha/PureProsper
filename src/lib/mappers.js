export const fromDbTransaction = (row) => ({
  id: row.id,
  date: new Date(row.date).getTime(),
  description: row.description,
  amount: Number(row.amount),
  type: row.type,
  categoryId: row.category_id,
  groupId: row.group_id,
  activityId: row.activity_id,
  isRecurring: row.is_recurring,
  recurringKey: row.recurring_key,
  recurringId: row.recurring_id,
});

export const toDbTransaction = (t, userId, groupId = null, activityId = null) => ({
  user_id: userId,
  group_id: groupId ?? t.groupId ?? null,
  activity_id: activityId ?? t.activityId ?? null,
  category_id: t.categoryId ?? null,
  description: t.description,
  amount: t.amount,
  type: t.type,
  date: new Date(t.date).toISOString(),
  is_recurring: t.isRecurring ?? false,
  recurring_key: t.recurringKey ?? null,
  recurring_id: t.recurringId ?? null,
});

export const fromDbRecurring = (row) => ({
  id: row.id,
  description: row.description,
  amount: Number(row.amount),
  type: row.type,
  frequency: row.frequency,
  dayOfMonth: row.day_of_month,
  categoryId: row.category_id,
  groupId: row.group_id,
  active: row.active,
  createdAt: new Date(row.created_at).getTime(),
});

export const toDbRecurring = (r, userId, groupId = null) => ({
  user_id: userId,
  group_id: groupId ?? r.groupId ?? null,
  category_id: r.categoryId ?? null,
  description: r.description,
  amount: r.amount,
  type: r.type,
  frequency: r.frequency,
  day_of_month: r.dayOfMonth,
  active: r.active ?? true,
});

export const fromDbGoal = (row) => ({
  id: row.id,
  name: row.name,
  target: Number(row.target),
  saved: Number(row.saved),
  deadline: row.deadline,
  createdAt: new Date(row.created_at).getTime(),
});

export const toDbGoal = (g, userId) => ({
  user_id: userId,
  name: g.name,
  target: g.target,
  saved: g.saved ?? 0,
  deadline: g.deadline,
});