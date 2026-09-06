import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";
import { fromDbGroup, toDbGroup } from "../lib/groupMappers";

const GroupContext = createContext();

const DEFAULT_GROUP_CATEGORIES = [
  { name: "Mensalidades", color: "#7FA87F", icon: "💶", type: "income" },
  { name: "Angariações", color: "#6B9B6B", icon: "🎉", type: "income" },
  { name: "Gasóleo", color: "#8A7866", icon: "⛽", budget: 0, type: "expense" },
  { name: "Prendas/Gastos", color: "#C46B6B", icon: "🎁", budget: 0, type: "expense" },
  { name: "Celebrações", color: "#A85252", icon: "✝️", budget: 0, type: "expense" },
  { name: "Atividades", color: "#D4A574", icon: "🎈", budget: 0, type: "expense" },
];

export const GroupProvider = ({ children }) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupIdState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setGroups([]); setActiveGroupIdState(null); setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at");

      if (!error) {
        setGroups((data || []).map(fromDbGroup));
        const saved = localStorage.getItem(`activeGroupId_${user.id}`);
        if (saved && (data || []).some(g => String(g.id) === saved)) {
          setActiveGroupIdState(Number(saved));
        }
      } else {
        console.error(error);
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const setActiveGroupId = useCallback((id) => {
    setActiveGroupIdState(id);
    if (user) {
      if (id) localStorage.setItem(`activeGroupId_${user.id}`, String(id));
      else localStorage.removeItem(`activeGroupId_${user.id}`);
    }
  }, [user]);

  const createGroup = async (name, fuelRatePerKm = 0.36) => {
    const { data, error } = await supabase
      .from("groups")
      .insert(toDbGroup({ name, fuelRatePerKm }, user.id))
      .select()
      .single();

    if (error) { console.error(error); return { error }; }

    const newGroup = fromDbGroup(data);
    setGroups(prev => [...prev, newGroup]);

    // Semear categorias sugeridas para este grupo (não bloqueia a criação se falhar)
    const { error: catError } = await supabase.from("categories").insert(
      DEFAULT_GROUP_CATEGORIES.map(c => ({ ...c, user_id: user.id, group_id: newGroup.id }))
    );
    if (catError) console.error(catError);

    setActiveGroupId(newGroup.id);
    return { data: newGroup };
  };

  const updateGroup = async (id, updates) => {
    const { error } = await supabase
      .from("groups")
      .update({
        name: updates.name,
        icon: updates.icon,
        fuel_rate_per_km: updates.fuelRatePerKm,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) { console.error(error); return { error }; }
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    return { error: null };
  };

  const deleteGroup = async (id) => {
    const { error } = await supabase.from("groups").delete().eq("id", id).eq("user_id", user.id);
    if (error) { console.error(error); return { error }; }
    setGroups(prev => prev.filter(g => g.id !== id));
    if (activeGroupId === id) setActiveGroupId(null);
    return { error: null };
  };

  const activeGroup = useMemo(
    () => groups.find(g => g.id === activeGroupId) || null,
    [groups, activeGroupId]
  );

  const value = {
    groups, activeGroup, activeGroupId, setActiveGroupId,
    createGroup, updateGroup, deleteGroup, loading,
  };

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};

export const useGroup = () => useContext(GroupContext);