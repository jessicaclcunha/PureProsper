import { createContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";
import { useGroup } from "./GroupContext";

export const CategoriesContext = createContext();

const defaultCategories = [
  { name: "Alimentação", color: "#A85252", icon: "🍽", budget: 500, type: "expense" },
  { name: "Transporte", color: "#8A7866", icon: "🚗", budget: 300, type: "expense" },
  { name: "Saúde", color: "#7FA87F", icon: "💊", budget: 200, type: "expense" },
  { name: "Lazer", color: "#D4A574", icon: "🎭", budget: 150, type: "expense" },
  { name: "Educação", color: "#8B3D3D", icon: "📚", budget: 250, type: "expense" },
  { name: "Casa", color: "#C46B6B", icon: "🏠", budget: 800, type: "expense" },
];

export const CategoriesProvider = ({ children }) => {
  const { user } = useAuth();
  const { activeGroupId } = useGroup();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setCategories([]); return; }

    const load = async () => {
      setLoading(true);

      let query = supabase.from("categories").select("*").eq("user_id", user.id).order("id");
      query = activeGroupId ? query.eq("group_id", activeGroupId) : query.is("group_id", null);

      const { data, error } = await query;

      if (error) { console.error(error); setLoading(false); return; }

      if (data.length === 0 && !activeGroupId) {
        const { data: seeded } = await supabase
          .from("categories")
          .insert(defaultCategories.map(c => ({ ...c, user_id: user.id, group_id: null })))
          .select();
        setCategories(seeded || []);
      } else {
        setCategories(data);
      }
      setLoading(false);
    };

    load();
  }, [user, activeGroupId]);

  const addCategory = async (newCategory) => {
    const { data, error } = await supabase
      .from("categories")
      .insert({ ...newCategory, user_id: user.id, group_id: activeGroupId || null })
      .select()
      .single();
    if (error) { console.error(error); return; }
    setCategories(prev => [...prev, data]);
  };

  const updateCategory = async (id, updatedCategory) => {
    const { error } = await supabase
      .from("categories")
      .update(updatedCategory)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) { console.error(error); return; }
    setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...updatedCategory } : cat));
  };

  const deleteCategory = async (id) => {
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) { console.error(error); return; }
    setCategories(prev => prev.filter(cat => cat.id !== id));
  };

  return (
    <CategoriesContext.Provider value={{ categories, loading, addCategory, updateCategory, deleteCategory }}>
      {children}
    </CategoriesContext.Provider>
  );
};