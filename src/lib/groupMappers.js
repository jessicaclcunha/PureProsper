export const fromDbGroup = (row) => ({
  id: row.id,
  name: row.name,
  icon: row.icon || "⛪",
  fuelRatePerKm: Number(row.fuel_rate_per_km ?? 0.36),
  createdAt: row.created_at,
});

export const toDbGroup = (g, userId) => ({
  user_id: userId,
  name: g.name,
  icon: g.icon || "⛪",
  fuel_rate_per_km: g.fuelRatePerKm ?? 0.36,
});

export const fromDbActivity = (row) => ({
  id: row.id,
  groupId: row.group_id,
  name: row.name,
  date: row.activity_date,
  participantsCount: row.participants_count,
  notes: row.notes,
  createdAt: row.created_at,
});

export const toDbActivity = (a, groupId, userId) => ({
  user_id: userId,
  group_id: groupId,
  name: a.name,
  activity_date: a.date || null,
  participants_count: a.participantsCount || null,
  notes: a.notes || null,
});

export const fromDbFuelTrip = (row) => ({
  id: row.id,
  groupId: row.group_id,
  activityId: row.activity_id,
  driverName: row.driver_name,
  date: row.trip_date,
  km: row.km != null ? Number(row.km) : null,
  rateUsed: row.rate_used != null ? Number(row.rate_used) : null,
  manualAmount: row.manual_amount != null ? Number(row.manual_amount) : null,
  amount: Number(row.amount),
  transactionId: row.transaction_id,
});

// t: { driverName, date, activityId, isManual, km, rateUsed, manualAmount }
export const toDbFuelTrip = (t, groupId, userId) => {
  const amount = t.isManual
    ? Number(t.manualAmount) || 0
    : Number(((t.km || 0) * (t.rateUsed || 0)).toFixed(2));

  return {
    user_id: userId,
    group_id: groupId,
    activity_id: t.activityId || null,
    driver_name: t.driverName,
    trip_date: t.date,
    km: t.isManual ? null : t.km,
    rate_used: t.isManual ? null : t.rateUsed,
    manual_amount: t.isManual ? t.manualAmount : null,
    amount,
  };
};