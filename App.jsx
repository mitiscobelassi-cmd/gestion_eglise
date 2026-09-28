import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Wallet,
  LayoutGrid,
  Plus,
  Trash2,
  BookOpen,
  MapPin,
  Phone,
  Clock,
  Lock,
  LogOut,
  Camera,
} from "lucide-react";
import logo from "./logo.jpg";

// ---------- Connexion à Supabase ----------
// Ces deux valeurs ne sont pas secrètes : elles sont faites pour être
// utilisées côté navigateur. La vraie sécurité est assurée par les
// règles RLS configurées dans Supabase.
const SUPABASE_URL = "https://mqbladggwscgfxmkluac.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_l6uAuZmZN-nf6rAsEaybMg_IMriRDTj";

async function sbAuth(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Échec de connexion");
  return data; // { access_token, user, ... }
}

async function sbSelect(table, token, query = "") {
  const headers = { apikey: SUPABASE_ANON_KEY };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*${query}`, { headers });
  if (!res.ok) throw new Error("Erreur de lecture (" + table + ")");
  return res.json();
}

async function sbInsert(table, token, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error("Erreur d'ajout (" + table + ")");
  const data = await res.json();
  return data[0];
}

async function sbUpdate(table, token, id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Erreur de mise à jour (" + table + ")");
  const data = await res.json();
  return data[0];
}

async function sbDelete(table, token, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Erreur de suppression (" + table + ")");
}

// ---------- Constantes du domaine ----------
const DEPARTEMENTS = ["Hommes (AHC)", "Femmes (ASC)", "Jeunesse"];
const MINISTERES = ["Chorale / Louange", "Intercession", "École du dimanche"];
const CATEGORIES_ENTREE = ["Culte d'intersemaine", "École du dimanche", "Dîme"];
const CATEGORIES_DEPENSE = ["Loyer", "Matériel", "Projet", "Autre"];

const EGLISE = {
  nom: "EEAD-BÉNIN",
  temple: "Temple Sion de Dokparou",
  adresse: "Dokparou, Parakou",
  telephone: "01 97 36 53 93",
};

const MOIS_FR = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

function moisLabel(dateStr) {
  const d = new Date(dateStr);
  return `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
}
function moisKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function fmtMontant(n) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

// ---------- Petits composants d'UI ----------
function Card({ children, className = "" }) {
  return <div className={`bg-[#FFFFFF] border border-[#D3DDF0] rounded-sm ${className}`}>{children}</div>;
}

function StatBlock({ label, value, sub }) {
  return (
    <Card className="p-5">
      <div className="text-[11px] tracking-wide text-[#64769A] font-medium">{label}</div>
      <div className="text-3xl font-serif text-[#0B1B45] mt-1">{value}</div>
      {sub && <div className="text-xs text-[#64769A] mt-1">{sub}</div>}
    </Card>
  );
}

function TextField({ label, ...props }) {
  return (
    <label className="block text-sm">
      <span className="text-[#3A4A6E] font-medium">{label}</span>
      <input
        {...props}
        className="mt-1 w-full border border-[#BFCCE6] bg-white rounded-sm px-3 py-2 text-[#0B1B45] focus:outline-none focus:ring-2 focus:ring-[#0B3BA6] focus:border-transparent"
      />
    </label>
  );
}

function SelectField({ label, children, ...props }) {
  return (
    <label className="block text-sm">
      <span className="text-[#3A4A6E] font-medium">{label}</span>
      <select
        {...props}
        className="mt-1 w-full border border-[#BFCCE6] bg-white rounded-sm px-3 py-2 text-[#0B1B45] focus:outline-none focus:ring-2 focus:ring-[#0B3BA6] focus:border-transparent"
      >
        {children}
      </select>
    </label>
  );
}

function CheckboxGroup({ label, options, selected, onToggle }) {
  return (
    <div>
      <span className="text-sm text-[#3A4A6E] font-medium">{label}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              onClick={() => onToggle(opt)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                active ? "bg-[#0B3BA6] border-[#0B3BA6] text-[#FFFFFF]" : "bg-white border-[#BFCCE6] text-[#3A4A6E] hover:border-[#0B3BA6]"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Page publique ----------
function PagePublique({ siteInfo, horaires, annonces, onAccesResponsables }) {
  return (
    <div className="min-h-screen bg-[#F2F6FD] text-[#0B1B45]">
      <style>{`
        .app-sans { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
        .font-serif { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 800; letter-spacing: -0.01em; }
      `}</style>
      <div className="app-sans">
        <header className="bg-[#FFFFFF] border-b-4 border-[#0B3BA6]">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo EEAD Temple Sion Dokparou" className="h-14 w-14 object-contain" />
              <div className="font-serif text-lg leading-tight text-[#0B3BA6]">{EGLISE.nom}</div>
            </div>
            <button
              onClick={onAccesResponsables}
              className="inline-flex items-center gap-2 text-sm border border-[#BFCCE6] px-4 py-2 rounded-sm text-[#3A4A6E] hover:border-[#0B3BA6] hover:text-[#0B3BA6] transition"
            >
              <Lock size={14} /> Espace responsables
            </button>
          </div>
        </header>

        <section className="max-w-4xl mx-auto px-6 pt-8">
          <div className="relative rounded-sm overflow-hidden border border-[#D3DDF0] bg-[#E4EAF6]" style={{ height: 320 }}>
            {siteInfo.photo ? (
              <img src={siteInfo.photo} alt="Photo de l'église" className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center gap-4"
                style={{ background: "linear-gradient(135deg, #082A7A 0%, #0B3BA6 55%, #1E6FE0 100%)" }}
              >
                <img src={logo} alt="" className="h-36 w-36 object-contain rounded-full bg-[#FFFFFF] p-2 shadow-lg" />
                <div className="text-[#FFFFFF] text-sm tracking-wide">Bienvenue à {EGLISE.nom}</div>
              </div>
            )}
          </div>

          <div className="mt-8">
            <h1 className="font-serif text-3xl text-[#0B3BA6]">{EGLISE.temple}</h1>
            <p className="mt-3 text-[#3A4A6E] leading-relaxed max-w-xl">{siteInfo.presentation}</p>
          </div>

          <div className="mt-10 grid sm:grid-cols-2 gap-6">
            <Card className="p-6">
              <h2 className="font-serif text-lg mb-4 flex items-center gap-2">
                <Clock size={17} className="text-[#0B3BA6]" /> Jours de culte
              </h2>
              <div className="space-y-3">
                {horaires.map((h) => (
                  <div key={h.id} className="flex items-baseline justify-between text-sm">
                    <div>
                      <div className="font-medium text-[#0B1B45]">{h.jour}</div>
                      <div className="text-[#64769A]">{h.activite}</div>
                    </div>
                    <div className="text-[#3A4A6E]">{h.heure}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="font-serif text-lg mb-4">Nous trouver</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-[#3A4A6E]">
                  <MapPin size={16} className="text-[#0B3BA6]" /> {EGLISE.adresse}
                </div>
                <div className="flex items-center gap-2 text-[#3A4A6E]">
                  <Phone size={16} className="text-[#0B3BA6]" /> {EGLISE.telephone}
                </div>
              </div>
            </Card>
          </div>

          {annonces.length > 0 && (
            <div className="mt-10">
              <h2 className="font-serif text-lg mb-4">Annonces & programmes spéciaux</h2>
              <div className="grid sm:grid-cols-2 gap-6">
                {[...annonces]
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((a) => (
                    <Card key={a.id} className="overflow-hidden">
                      {a.image && <img src={a.image} alt={a.titre} className="w-full h-40 object-cover" />}
                      <div className="p-5">
                        <div className="text-xs text-[#64769A]">
                          {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        </div>
                        <h3 className="font-serif text-lg mt-1">{a.titre}</h3>
                        <p className="text-sm text-[#3A4A6E] mt-2 leading-relaxed whitespace-pre-line">{a.texte}</p>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </section>

        <footer className="max-w-4xl mx-auto px-6 py-10 mt-6 text-xs text-[#64769A]">
          {EGLISE.nom} — {EGLISE.temple}
        </footer>
      </div>
    </div>
  );
}

// ---------- Page de connexion (vraie authentification Supabase) ----------
function PageConnexion({ onConnexion, onRetour }) {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function valider(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    try {
      const auth = await sbAuth(email.trim(), motDePasse);
      await onConnexion(auth);
    } catch (err) {
      if (err instanceof TypeError) {
        setErreur("Impossible de joindre le serveur (réseau bloqué ou coupé).");
      } else {
        setErreur(err.message || "Échec de connexion.");
      }
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F6FD] flex items-center justify-center px-6">
      <div className="app-sans w-full max-w-sm">
        <style>{`.font-serif { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 800; letter-spacing: -0.01em; }`}</style>
        <Card className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <img src={logo} alt="" className="h-12 w-12 object-contain" />
            <div>
              <div className="font-serif text-lg leading-tight">Espace responsables</div>
              <div className="text-xs text-[#64769A]">Effectif & finances</div>
            </div>
          </div>
          <form onSubmit={valider} className="space-y-4">
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" autoFocus />
            <TextField label="Mot de passe" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} placeholder="••••••••" />
            {erreur && <p className="text-xs text-[#0B3BA6]">{erreur}</p>}
            <button
              type="submit"
              disabled={enCours}
              className="w-full bg-[#0B3BA6] text-[#FFFFFF] py-2.5 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition disabled:opacity-60"
            >
              {enCours ? "Connexion..." : "Se connecter"}
            </button>
          </form>
          <button onClick={onRetour} className="mt-4 text-xs text-[#64769A] hover:text-[#3A4A6E] transition">
            ← Retour au site
          </button>
        </Card>
      </div>
    </div>
  );
}

// ---------- Vue Effectif ----------
function VueEffectif({ token, membres, setMembres, presences, setPresences }) {
  const [nom, setNom] = useState("");
  const [deps, setDeps] = useState([]);
  const [mins, setMins] = useState([]);
  const [dateP, setDateP] = useState(todayStr());
  const [hommes, setHommes] = useState("");
  const [femmes, setFemmes] = useState("");
  const [jeunes, setJeunes] = useState("");
  const [erreur, setErreur] = useState("");

  const toggleDep = (d) => setDeps((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const toggleMin = (m) => setMins((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  async function ajouterMembre(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    try {
      const nouveau = await sbInsert("membres", token, { nom: nom.trim(), departements: deps, ministeres: mins });
      setMembres((cur) => [...cur, nouveau]);
      setNom(""); setDeps([]); setMins([]);
    } catch (err) { setErreur(err.message); }
  }

  async function supprimerMembre(id) {
    try {
      await sbDelete("membres", token, id);
      setMembres((cur) => cur.filter((m) => m.id !== id));
    } catch (err) { setErreur(err.message); }
  }

  async function ajouterPresence(e) {
    e.preventDefault();
    if (!hommes && !femmes && !jeunes) return;
    try {
      const nouveau = await sbInsert("presences", token, {
        date: dateP, hommes: Number(hommes) || 0, femmes: Number(femmes) || 0, jeunes: Number(jeunes) || 0,
      });
      setPresences((cur) => [...cur, nouveau]);
      setHommes(""); setFemmes(""); setJeunes("");
    } catch (err) { setErreur(err.message); }
  }

  const statsMensuelles = useMemo(() => {
    const map = {};
    for (const p of presences) {
      const key = moisKey(p.date);
      if (!map[key]) map[key] = { key, label: moisLabel(p.date), hommes: 0, femmes: 0, jeunes: 0 };
      map[key].hommes += p.hommes; map[key].femmes += p.femmes; map[key].jeunes += p.jeunes;
    }
    return Object.values(map).sort((a, b) => (a.key > b.key ? 1 : -1));
  }, [presences]);

  const dernierePresence = presences[presences.length - 1];
  const derniereTotal = dernierePresence ? dernierePresence.hommes + dernierePresence.femmes + dernierePresence.jeunes : 0;

  return (
    <div className="space-y-8">
      {erreur && <p className="text-sm text-[#0B3BA6]">{erreur}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatBlock label="Membres enregistrés" value={membres.length} />
        <StatBlock label="Dernier comptage dominical" value={derniereTotal} sub={dernierePresence ? new Date(dernierePresence.date).toLocaleDateString("fr-FR") : "—"} />
        <StatBlock label="Relevés de présence" value={presences.length} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Ajouter un membre</h3>
          <form onSubmit={ajouterMembre} className="space-y-4">
            <TextField label="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Grace Mbala" />
            <CheckboxGroup label="Département d'appartenance" options={DEPARTEMENTS} selected={deps} onToggle={toggleDep} />
            <CheckboxGroup label="Département(s) ministériel(s)" options={MINISTERES} selected={mins} onToggle={toggleMin} />
            <button type="submit" className="inline-flex items-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition">
              <Plus size={16} /> Ajouter le membre
            </button>
          </form>
        </Card>

        <Card className="p-6">
          <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Comptage du dimanche</h3>
          <form onSubmit={ajouterPresence} className="space-y-4">
            <TextField label="Date du culte" type="date" value={dateP} onChange={(e) => setDateP(e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <TextField label="Hommes" type="number" min="0" value={hommes} onChange={(e) => setHommes(e.target.value)} />
              <TextField label="Femmes" type="number" min="0" value={femmes} onChange={(e) => setFemmes(e.target.value)} />
              <TextField label="Jeunes" type="number" min="0" value={jeunes} onChange={(e) => setJeunes(e.target.value)} />
            </div>
            <button type="submit" className="inline-flex items-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition">
              <Plus size={16} /> Enregistrer le comptage
            </button>
          </form>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Registre des membres</h3>
        {membres.length === 0 ? (
          <p className="text-sm text-[#64769A]">Aucun membre enregistré pour le moment.</p>
        ) : (
          <div className="divide-y divide-[#E4EAF6]">
            {membres.map((m) => (
              <div key={m.id} className="py-3 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-[#0B1B45]">{m.nom}</div>
                  <div className="text-xs text-[#64769A] mt-1">{[...(m.departements || []), ...(m.ministeres || [])].join(" · ") || "Aucun département renseigné"}</div>
                </div>
                <button onClick={() => supprimerMembre(m.id)} className="text-[#64769A] hover:text-[#0B3BA6] transition"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Présence mensuelle</h3>
        {statsMensuelles.length === 0 ? (
          <p className="text-sm text-[#64769A]">Pas encore de données à afficher.</p>
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={statsMensuelles}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4EAF6" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#3A4A6E" }} />
                <YAxis tick={{ fontSize: 12, fill: "#3A4A6E" }} />
                <Tooltip contentStyle={{ borderRadius: 4, borderColor: "#D3DDF0" }} />
                <Legend />
                <Bar dataKey="hommes" name="Hommes" fill="#0B3BA6" />
                <Bar dataKey="femmes" name="Femmes" fill="#D81B1B" />
                <Bar dataKey="jeunes" name="Jeunes" fill="#E3A21A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Vue Finances ----------
function VueFinances({ token, finances, setFinances }) {
  const [type, setType] = useState("entree");
  const [date, setDate] = useState(todayStr());
  const [categorie, setCategorie] = useState(CATEGORIES_ENTREE[0]);
  const [montant, setMontant] = useState("");
  const [description, setDescription] = useState("");
  const [erreur, setErreur] = useState("");

  const categories = type === "entree" ? CATEGORIES_ENTREE : CATEGORIES_DEPENSE;

  function changerType(t) {
    setType(t);
    setCategorie(t === "entree" ? CATEGORIES_ENTREE[0] : CATEGORIES_DEPENSE[0]);
  }

  async function ajouterMouvement(e) {
    e.preventDefault();
    if (!montant) return;
    try {
      const nouveau = await sbInsert("finances", token, { date, type, categorie, montant: Number(montant), description: description.trim() });
      setFinances((cur) => [...cur, nouveau]);
      setMontant(""); setDescription("");
    } catch (err) { setErreur(err.message); }
  }

  async function supprimerMouvement(id) {
    try {
      await sbDelete("finances", token, id);
      setFinances((cur) => cur.filter((f) => f.id !== id));
    } catch (err) { setErreur(err.message); }
  }

  const statsMensuelles = useMemo(() => {
    const map = {};
    for (const f of finances) {
      const key = moisKey(f.date);
      if (!map[key]) map[key] = { key, label: moisLabel(f.date), entrees: 0, depenses: 0 };
      if (f.type === "entree") map[key].entrees += Number(f.montant);
      else map[key].depenses += Number(f.montant);
    }
    return Object.values(map).sort((a, b) => (a.key > b.key ? 1 : -1));
  }, [finances]);

  const totalEntrees = finances.filter((f) => f.type === "entree").reduce((s, f) => s + Number(f.montant), 0);
  const totalDepenses = finances.filter((f) => f.type === "depense").reduce((s, f) => s + Number(f.montant), 0);
  const solde = totalEntrees - totalDepenses;
  const mouvementsTries = [...finances].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="space-y-8">
      {erreur && <p className="text-sm text-[#0B3BA6]">{erreur}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatBlock label="Total des entrées" value={`${fmtMontant(totalEntrees)} $`} />
        <StatBlock label="Total des dépenses" value={`${fmtMontant(totalDepenses)} $`} />
        <StatBlock label="Solde" value={`${solde >= 0 ? "+" : ""}${fmtMontant(solde)} $`} />
      </div>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Enregistrer un mouvement</h3>
        <form onSubmit={ajouterMouvement} className="space-y-4">
          <div className="flex gap-2">
            {[{ key: "entree", label: "Entrée" }, { key: "depense", label: "Dépense" }].map((t) => (
              <button
                type="button" key={t.key} onClick={() => changerType(t.key)}
                className={`flex-1 text-sm py-2 rounded-sm border transition ${type === t.key ? "bg-[#0B3BA6] border-[#0B3BA6] text-[#FFFFFF]" : "bg-white border-[#BFCCE6] text-[#3A4A6E]"}`}
              >{t.label}</button>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <SelectField label="Catégorie" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectField>
            <TextField label="Montant ($)" type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0.00" />
          </div>
          <TextField label="Description (facultatif)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex : Câbles sono, projet toiture..." />
          <button type="submit" className="inline-flex items-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition">
            <Plus size={16} /> Enregistrer
          </button>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Journal des mouvements</h3>
        {mouvementsTries.length === 0 ? (
          <p className="text-sm text-[#64769A]">Aucun mouvement enregistré pour le moment.</p>
        ) : (
          <div className="divide-y divide-[#E4EAF6]">
            {mouvementsTries.map((f) => (
              <div key={f.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-[#0B1B45]">{f.categorie}{f.description && <span className="text-[#64769A]"> — {f.description}</span>}</div>
                  <div className="text-xs text-[#64769A] mt-0.5">{new Date(f.date).toLocaleDateString("fr-FR")}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-medium ${f.type === "entree" ? "text-[#0B3BA6]" : "text-[#D81B1B]"}`}>{f.type === "entree" ? "+" : "-"}{fmtMontant(f.montant)} $</span>
                  <button onClick={() => supprimerMouvement(f.id)} className="text-[#64769A] hover:text-[#0B3BA6] transition"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Bilan mensuel</h3>
        {statsMensuelles.length === 0 ? (
          <p className="text-sm text-[#64769A]">Pas encore de données à afficher.</p>
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={statsMensuelles}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4EAF6" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#3A4A6E" }} />
                <YAxis tick={{ fontSize: 12, fill: "#3A4A6E" }} />
                <Tooltip contentStyle={{ borderRadius: 4, borderColor: "#D3DDF0" }} />
                <Legend />
                <Bar dataKey="entrees" name="Entrées" fill="#0B3BA6" />
                <Bar dataKey="depenses" name="Dépenses" fill="#D81B1B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Vue Site & Annonces ----------
function VueSite({ token, siteInfo, setSiteInfo, horaires, setHoraires, annonces, setAnnonces }) {
  const [presentation, setPresentation] = useState(siteInfo.presentation || "");
  const [jour, setJour] = useState("");
  const [heure, setHeure] = useState("");
  const [activite, setActivite] = useState("");
  const [titre, setTitre] = useState("");
  const [dateAnnonce, setDateAnnonce] = useState(todayStr());
  const [texte, setTexte] = useState("");
  const [image, setImage] = useState(null);
  const [erreur, setErreur] = useState("");

  async function enregistrerPresentation(e) {
    e.preventDefault();
    try {
      await sbUpdate("site_info", token, siteInfo.id, { presentation });
      setSiteInfo((cur) => ({ ...cur, presentation }));
    } catch (err) { setErreur(err.message); }
  }

  async function changerPhoto(dataUrl) {
    try {
      await sbUpdate("site_info", token, siteInfo.id, { photo: dataUrl });
      setSiteInfo((cur) => ({ ...cur, photo: dataUrl }));
    } catch (err) { setErreur(err.message); }
  }

  async function ajouterHoraire(e) {
    e.preventDefault();
    if (!jour.trim() || !heure.trim()) return;
    try {
      const nouveau = await sbInsert("horaires", token, { jour: jour.trim(), heure: heure.trim(), activite: activite.trim() });
      setHoraires((cur) => [...cur, nouveau]);
      setJour(""); setHeure(""); setActivite("");
    } catch (err) { setErreur(err.message); }
  }

  async function supprimerHoraire(id) {
    try {
      await sbDelete("horaires", token, id);
      setHoraires((cur) => cur.filter((h) => h.id !== id));
    } catch (err) { setErreur(err.message); }
  }

  async function ajouterAnnonce(e) {
    e.preventDefault();
    if (!titre.trim() || !texte.trim()) return;
    try {
      const nouveau = await sbInsert("annonces", token, { titre: titre.trim(), date: dateAnnonce, texte: texte.trim(), image });
      setAnnonces((cur) => [...cur, nouveau]);
      setTitre(""); setTexte(""); setImage(null);
    } catch (err) { setErreur(err.message); }
  }

  async function supprimerAnnonce(id) {
    try {
      await sbDelete("annonces", token, id);
      setAnnonces((cur) => cur.filter((a) => a.id !== id));
    } catch (err) { setErreur(err.message); }
  }

  return (
    <div className="space-y-8">
      {erreur && <p className="text-sm text-[#0B3BA6]">{erreur}</p>}

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Photo de la page publique</h3>
        <div className="relative rounded-sm overflow-hidden border border-[#D3DDF0] bg-[#E4EAF6]" style={{ height: 200 }}>
          {siteInfo.photo ? (
            <img src={siteInfo.photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#64769A] text-sm">Aucune photo</div>
          )}
          <label className="absolute bottom-3 right-3 inline-flex items-center gap-2 bg-[#FFFFFF]/90 backdrop-blur px-3 py-1.5 rounded-sm text-xs text-[#3A4A6E] border border-[#D3DDF0] cursor-pointer hover:border-[#0B3BA6] transition">
            <Camera size={13} /> Changer la photo
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => changerPhoto(reader.result);
              reader.readAsDataURL(file);
            }} />
          </label>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Texte de présentation</h3>
        <form onSubmit={enregistrerPresentation} className="space-y-4">
          <label className="block text-sm">
            <span className="text-[#3A4A6E] font-medium">Message affiché sur la page publique</span>
            <textarea value={presentation} onChange={(e) => setPresentation(e.target.value)} rows={4}
              className="mt-1 w-full border border-[#BFCCE6] bg-white rounded-sm px-3 py-2 text-[#0B1B45] focus:outline-none focus:ring-2 focus:ring-[#0B3BA6] focus:border-transparent" />
          </label>
          <button type="submit" className="inline-flex items-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition">Enregistrer le texte</button>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Jours de culte & activités</h3>
        <div className="divide-y divide-[#E4EAF6] mb-5">
          {horaires.map((h) => (
            <div key={h.id} className="py-3 flex items-center justify-between gap-4">
              <div className="text-sm"><span className="font-medium text-[#0B1B45]">{h.jour}</span><span className="text-[#64769A]"> — {h.activite} ({h.heure})</span></div>
              <button onClick={() => supprimerHoraire(h.id)} className="text-[#64769A] hover:text-[#0B3BA6] transition"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <form onSubmit={ajouterHoraire} className="grid sm:grid-cols-4 gap-3 items-end">
          <TextField label="Jour" value={jour} onChange={(e) => setJour(e.target.value)} placeholder="Ex : Vendredi" />
          <TextField label="Horaire" value={heure} onChange={(e) => setHeure(e.target.value)} placeholder="Ex : 18h00 – 20h00" />
          <TextField label="Activité" value={activite} onChange={(e) => setActivite(e.target.value)} placeholder="Ex : Veillée de prière" />
          <button type="submit" className="inline-flex items-center justify-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition h-fit"><Plus size={16} /> Ajouter</button>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Publier une annonce</h3>
        <form onSubmit={ajouterAnnonce} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex : Conférence de la femme" />
            <TextField label="Date" type="date" value={dateAnnonce} onChange={(e) => setDateAnnonce(e.target.value)} />
          </div>
          <label className="block text-sm">
            <span className="text-[#3A4A6E] font-medium">Détails</span>
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} placeholder="Décris le programme spécial..."
              className="mt-1 w-full border border-[#BFCCE6] bg-white rounded-sm px-3 py-2 text-[#0B1B45] focus:outline-none focus:ring-2 focus:ring-[#0B3BA6] focus:border-transparent" />
          </label>
          <label className="block text-sm">
            <span className="text-[#3A4A6E] font-medium">Affiche (image, facultatif)</span>
            <input type="file" accept="image/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setImage(reader.result);
              reader.readAsDataURL(file);
            }} className="mt-1 block w-full text-sm text-[#3A4A6E]" />
          </label>
          <button type="submit" className="inline-flex items-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition"><Plus size={16} /> Publier l'annonce</button>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Annonces publiées</h3>
        {annonces.length === 0 ? (
          <p className="text-sm text-[#64769A]">Aucune annonce pour le moment.</p>
        ) : (
          <div className="divide-y divide-[#E4EAF6]">
            {[...annonces].sort((a, b) => (a.date < b.date ? 1 : -1)).map((a) => (
              <div key={a.id} className="py-3 flex items-center justify-between gap-4">
                <div><div className="text-sm font-medium text-[#0B1B45]">{a.titre}</div><div className="text-xs text-[#64769A]">{new Date(a.date).toLocaleDateString("fr-FR")}</div></div>
                <button onClick={() => supprimerAnnonce(a.id)} className="text-[#64769A] hover:text-[#0B3BA6] transition"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Vue d'ensemble ----------
function VueEnsemble({ membres, presences, finances }) {
  const totalEntrees = finances.filter((f) => f.type === "entree").reduce((s, f) => s + Number(f.montant), 0);
  const totalDepenses = finances.filter((f) => f.type === "depense").reduce((s, f) => s + Number(f.montant), 0);
  const dernierePresence = presences[presences.length - 1];
  const derniereTotal = dernierePresence ? dernierePresence.hommes + dernierePresence.femmes + dernierePresence.jeunes : 0;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatBlock label="Membres enregistrés" value={membres.length} />
      <StatBlock label="Dernier comptage" value={derniereTotal} sub={dernierePresence ? new Date(dernierePresence.date).toLocaleDateString("fr-FR") : "—"} />
      <StatBlock label="Total entrées (cumulé)" value={`${fmtMontant(totalEntrees)} $`} />
      <StatBlock label="Solde cumulé" value={`${fmtMontant(totalEntrees - totalDepenses)} $`} />
    </div>
  );
}

// ---------- Application principale ----------
export default function GestionEglise() {
  const [page, setPage] = useState("public"); // "public" | "connexion" | "admin"
  const [onglet, setOnglet] = useState("ensemble");
  const [session, setSession] = useState(null); // { token, role, email }
  const [chargementPublic, setChargementPublic] = useState(true);
  const [chargementAdmin, setChargementAdmin] = useState(false);
  const [erreurGlobale, setErreurGlobale] = useState("");

  const [siteInfo, setSiteInfo] = useState({ id: 1, presentation: "", photo: null });
  const [horaires, setHoraires] = useState([]);
  const [annonces, setAnnonces] = useState([]);
  const [membres, setMembres] = useState([]);
  const [presences, setPresences] = useState([]);
  const [finances, setFinances] = useState([]);

  // Chargement des données publiques (site vitrine)
  useEffect(() => {
    (async () => {
      try {
        const [si, ho, an] = await Promise.all([
          sbSelect("site_info", null),
          sbSelect("horaires", null),
          sbSelect("annonces", null),
        ]);
        if (si?.[0]) setSiteInfo(si[0]);
        setHoraires(ho || []);
        setAnnonces(an || []);
      } catch (err) {
        setErreurGlobale("Impossible de charger les informations du site pour le moment.");
      } finally {
        setChargementPublic(false);
      }
    })();
  }, []);

  async function connexion(auth) {
    const token = auth.access_token;
    const roles = await sbSelect("roles", token, `&user_id=eq.${auth.user.id}`);
    if (!roles?.[0]) {
      throw new Error("Connexion réussie, mais aucun rôle n'est attribué à ce compte.");
    }
    const role = roles[0].role;

    const [m, p, f] = await Promise.all([
      sbSelect("membres", token),
      sbSelect("presences", token),
      sbSelect("finances", token),
    ]);
    setMembres(m || []);
    setPresences(p || []);
    setFinances(f || []);
    setSession({ token, role, email: auth.user.email });
    setOnglet("ensemble");
    setPage("admin");
  }

  function deconnexion() {
    setSession(null);
    setPage("public");
  }

  if (chargementPublic) {
    return <div className="min-h-screen bg-[#F2F6FD] flex items-center justify-center text-[#64769A] text-sm">Chargement…</div>;
  }

  if (page === "public") {
    return <PagePublique siteInfo={siteInfo} horaires={horaires} annonces={annonces} onAccesResponsables={() => setPage("connexion")} />;
  }

  if (page === "connexion") {
    return <PageConnexion onConnexion={connexion} onRetour={() => setPage("public")} />;
  }

  const tousOnglets = [
    { key: "ensemble", label: "Vue d'ensemble", icon: LayoutGrid, roles: ["admin", "finances", "effectif"] },
    { key: "effectif", label: "Effectif", icon: Users, roles: ["admin", "effectif"] },
    { key: "finances", label: "Finances", icon: Wallet, roles: ["admin", "finances"] },
    { key: "site", label: "Site & Annonces", icon: BookOpen, roles: ["admin"] },
  ];
  const onglets = tousOnglets.filter((o) => o.roles.includes(session?.role));

  return (
    <div className="min-h-screen bg-[#F2F6FD] text-[#0B1B45]">
      <style>{`
        .app-sans { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
        .font-serif { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 800; letter-spacing: -0.01em; }
      `}</style>
      <div className="app-sans">
        <header className="border-b border-[#D3DDF0] bg-[#FFFFFF]">
          <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
            <img src={logo} alt="" className="h-11 w-11 object-contain" />
            <div className="flex-1">
              <div className="font-serif text-xl leading-tight">{EGLISE.temple}</div>
              <div className="text-xs text-[#64769A]">{session?.email} — {session?.role}</div>
            </div>
            <button onClick={deconnexion} className="inline-flex items-center gap-2 text-sm border border-[#BFCCE6] px-3 py-1.5 rounded-sm text-[#3A4A6E] hover:border-[#0B3BA6] hover:text-[#0B3BA6] transition">
              <LogOut size={14} /> Déconnexion
            </button>
          </div>
          <nav className="max-w-5xl mx-auto px-6 flex gap-1">
            {onglets.map((o) => {
              const Icon = o.icon;
              const active = onglet === o.key;
              return (
                <button key={o.key} onClick={() => setOnglet(o.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${active ? "border-[#0B3BA6] text-[#0B3BA6]" : "border-transparent text-[#64769A] hover:text-[#3A4A6E]"}`}>
                  <Icon size={15} /> {o.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-8">
          {erreurGlobale && <p className="text-sm text-[#0B3BA6] mb-4">{erreurGlobale}</p>}
          {chargementAdmin ? (
            <p className="text-sm text-[#64769A]">Chargement des données…</p>
          ) : (
            <>
              {onglet === "ensemble" && <VueEnsemble membres={membres} presences={presences} finances={finances} />}
              {onglet === "effectif" && (
                <VueEffectif token={session.token} membres={membres} setMembres={setMembres} presences={presences} setPresences={setPresences} />
              )}
              {onglet === "finances" && <VueFinances token={session.token} finances={finances} setFinances={setFinances} />}
              {onglet === "site" && (
                <VueSite token={session.token} siteInfo={siteInfo} setSiteInfo={setSiteInfo} horaires={horaires} setHoraires={setHoraires} annonces={annonces} setAnnonces={setAnnonces} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
