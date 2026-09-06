import { useState } from "react";
import GroupSwitcher from "./GroupSwitcher";
import { useGroup } from "../contexts/GroupContext";

const LogoMark = () => (
  <img src="/logo.png" alt="PureProsper" style={{ width: 26, height: 26 }} />
);

const Header = ({ view, setView, userEmail }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { activeGroup } = useGroup();

  const handleNavClick = (newView) => {
    setView(newView);
    setIsMenuOpen(false);
  };

  const initials = userEmail ? userEmail[0].toUpperCase() : "?";

  return (
    <header className="main-header">
      <div className="header-content">
        <div className="logo-section">
          <LogoMark />
          <div className="logo-text-block">
            <h1>PureProsper</h1>
            <span className="tagline">Gestão de Finanças Pessoal</span>
          </div>
        </div>

        <nav className={`main-nav ${isMenuOpen ? 'open' : ''}`}>
          <button onClick={() => handleNavClick("dashboard")} className={`nav-link ${view === "dashboard" ? "active" : ""}`}>
            <span className="nav-text">Dashboard</span>
          </button>
          <button onClick={() => handleNavClick("transactions")} className={`nav-link ${view === "transactions" ? "active" : ""}`}>
            <span className="nav-text">Transações</span>
          </button>
          <button onClick={() => handleNavClick("analysis")} className={`nav-link ${view === "analysis" ? "active" : ""}`}>
            <span className="nav-text">Análise</span>
          </button>
          <button onClick={() => handleNavClick("goals")} className={`nav-link ${view === "goals" ? "active" : ""}`}>
            <span className="nav-text">Metas</span>
          </button>
          <button onClick={() => handleNavClick("categories")} className={`nav-link ${view === "categories" ? "active" : ""}`}>
            <span className="nav-text">Categorias</span>
          </button>
          {activeGroup && (
            <>
              <button onClick={() => handleNavClick("activities")} className={`nav-link ${view === "activities" ? "active" : ""}`}>
                <span className="nav-text">Atividades</span>
              </button>
              <button onClick={() => handleNavClick("fuel")} className={`nav-link ${view === "fuel" ? "active" : ""}`}>
                <span className="nav-text">Gasóleo</span>
              </button>
            </>
          )}
        </nav>

        <div className="header-actions">
          <GroupSwitcher />

          <button
            onClick={() => handleNavClick("account")}
            className={`account-avatar-btn ${view === "account" ? "active" : ""}`}
            aria-label="Minha conta"
            title="Minha conta"
          >
            <span className="nav-user-avatar">{initials}</span>
          </button>

          <button className="hamburger-btn" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Menu">
            <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
          </button>
        </div>
      </div>

      {isMenuOpen && <div className="nav-overlay" onClick={() => setIsMenuOpen(false)} />}
    </header>
  );
};

export default Header;