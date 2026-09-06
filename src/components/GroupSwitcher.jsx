import { useState } from "react";
import { useGroup } from "../contexts/GroupContext";

const GroupSwitcher = () => {
  const { groups, activeGroup, setActiveGroupId, createGroup } = useGroup();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("0.36");

  const handleSelect = (id) => {
    setActiveGroupId(id);
    setIsOpen(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const { error } = await createGroup(newName.trim(), parseFloat(newRate) || 0.36);
    if (!error) {
      setNewName("");
      setNewRate("0.36");
      setIsCreating(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="group-switcher">
      <button
        type="button"
        className="group-switcher-btn"
        onClick={() => setIsOpen(o => !o)}
        title="Trocar de conta"
      >
        <span className="group-switcher-icon">{activeGroup ? activeGroup.icon : "👤"}</span>
        <span className="group-switcher-label">{activeGroup ? activeGroup.name : "Pessoal"}</span>
        <span className="group-switcher-caret">▾</span>
      </button>

      {isOpen && (
        <>
          <div className="group-switcher-overlay" onClick={() => setIsOpen(false)} />
          <div className="group-switcher-menu">
            <button
              type="button"
              className={`group-switcher-item ${!activeGroup ? "active" : ""}`}
              onClick={() => handleSelect(null)}
            >
              👤 Pessoal
            </button>

            {groups.map(g => (
              <button
                key={g.id}
                type="button"
                className={`group-switcher-item ${activeGroup?.id === g.id ? "active" : ""}`}
                onClick={() => handleSelect(g.id)}
              >
                {g.icon} {g.name}
              </button>
            ))}

            <div className="group-switcher-divider" />

            {!isCreating ? (
              <button
                type="button"
                className="group-switcher-item group-switcher-new"
                onClick={() => setIsCreating(true)}
              >
                + Nova conta de grupo
              </button>
            ) : (
              <form onSubmit={handleCreate} className="group-switcher-form">
                <input
                  type="text"
                  placeholder="Nome do grupo"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="form-input"
                  autoFocus
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="€/km (gasóleo)"
                  value={newRate}
                  onChange={e => setNewRate(e.target.value)}
                  className="form-input"
                />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="submit" className="btn btn-primary btn-small" style={{ flex: 1 }}>
                    Criar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="btn btn-secondary btn-small"
                    style={{ flex: 1 }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default GroupSwitcher;