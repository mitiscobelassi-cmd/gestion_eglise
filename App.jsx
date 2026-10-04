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
  UserCheck,
  Mic,
  PlayCircle,
  Navigation,
  Pencil,
  Download,
  Printer,
} from "lucide-react";

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
const DEPARTEMENTS = ["Hommes (AHC)", "Femmes (ASC)", "Jeunesse", "Enfants"];
const MINISTERES = ["Chorale / Louange", "Intercession", "École du dimanche"];
const CATEGORIES_ENTREE = ["Culte d'intersemaine", "École du dimanche", "Offrande", "Dîme", "Don"];
const FONCTIONS_COMITE = ["Pasteur", "Pasteur adjoint", "Diacre", "Responsable de département"];
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
// Exporte un tableau d'objets en fichier CSV téléchargeable
function exporterCSV(nomFichier, lignes, colonnes) {
  const entete = colonnes.map((c) => c.label).join(";");
  const corps = lignes.map((l) =>
    colonnes.map((c) => {
      const v = c.valeur(l);
      const txt = v === null || v === undefined ? "" : String(v);
      return `"${txt.replace(/"/g, '""')}"`;
    }).join(";")
  );
  const csv = "\uFEFF" + [entete, ...corps].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomFichier;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function fmtMontant(n) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}


// Réduit une photo (téléphone = plusieurs Mo) avant de l'envoyer, et renvoie un Blob
function redimensionnerImageBlob(file, maxSize = 1200, qualite = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Conversion impossible"))), "image/jpeg", qualite);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Redimensionne une photo puis l'envoie dans Supabase Storage (bucket "eglise-media").
// Renvoie l'URL publique de l'image, à enregistrer dans la table concernée.
async function envoyerImage(token, file, dossier, maxSize = 1200) {
  const blob = await redimensionnerImageBlob(file, maxSize);
  const nomFichier = `${dossier}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/eglise-media/${nomFichier}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/jpeg",
    },
    body: blob,
  });
  if (!res.ok) throw new Error("Échec de l'envoi de l'image.");
  return `${SUPABASE_URL}/storage/v1/object/public/eglise-media/${nomFichier}`;
}

function initiales(nom) {
  return (nom || "").split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
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


// ---------- En-tête des pages publiques ----------
function PublicHeader({ courant, onNavigate, onAccesResponsables }) {
  const liens = [
    { key: "public", label: "Accueil" },
    { key: "comite", label: "Notre comité" },
    { key: "enseignements", label: "Enseignements" },
  ];
  return (
    <header className="bg-[#FFFFFF] border-b-4 border-[#0B3BA6]">
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Logo EEAD Temple Sion Dokparou" className="h-14 w-14 object-contain" />
          <div className="font-serif text-lg leading-tight text-[#0B3BA6]">{EGLISE.nom}</div>
        </div>
        <button
          onClick={onAccesResponsables}
          className="inline-flex items-center gap-2 text-sm border border-[#BFCCE6] px-3 sm:px-4 py-2 rounded-sm text-[#3A4A6E] hover:border-[#0B3BA6] hover:text-[#0B3BA6] transition"
        >
          <Lock size={14} />
          <span className="hidden sm:inline">Espace responsables</span>
          <span className="sm:hidden">Responsables</span>
        </button>
      </div>
      <nav className="max-w-4xl mx-auto px-6 flex gap-1">
        {liens.map((l) => (
          <button
            key={l.key}
            onClick={() => onNavigate(l.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              courant === l.key ? "border-[#0B3BA6] text-[#0B3BA6]" : "border-transparent text-[#64769A] hover:text-[#3A4A6E]"
            }`}
          >
            {l.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

// Reconnaît un lien YouTube et renvoie une URL de lecture intégrée. Sinon, renvoie null.
function idYoutube(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}


// ---------- Confirmation avant suppression ----------
function ConfirmerSuppression({ titre, message, onConfirmer, onAnnuler }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" onClick={onAnnuler}>
      <div className="bg-white rounded-sm max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-lg text-[#0B1B45]">{titre}</h3>
        <p className="text-sm text-[#3A4A6E] mt-2">{message}</p>
        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={onAnnuler} className="text-sm px-4 py-2 rounded-sm border border-[#BFCCE6] text-[#3A4A6E] hover:border-[#0B3BA6] transition">Annuler</button>
          <button onClick={onConfirmer} className="text-sm px-4 py-2 rounded-sm bg-[#D81B1B] text-white hover:bg-[#A61414] transition">Supprimer</button>
        </div>
      </div>
    </div>
  );
}


// ---------- Page publique ----------
function PagePublique({ siteInfo, horaires, annonces, onNavigate, onAccesResponsables }) {
  return (
    <div className="min-h-screen bg-[#F2F6FD] text-[#0B1B45]">
      <style>{`
        .app-sans { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
        .font-serif { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 800; letter-spacing: -0.01em; }
      `}</style>
      <div className="app-sans">
        <PublicHeader courant="public" onNavigate={onNavigate} onAccesResponsables={onAccesResponsables} />

        <section className="max-w-4xl mx-auto px-6 pt-8">
          <div className="relative rounded-sm overflow-hidden border border-[#D3DDF0] bg-[#E4EAF6]" style={{ height: 320 }}>
            {siteInfo.photo ? (
              <img src={siteInfo.photo} alt="Photo de l'église" className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center gap-4"
                style={{ background: "linear-gradient(135deg, #082A7A 0%, #0B3BA6 55%, #1E6FE0 100%)" }}
              >
                <img src="/logo.jpg" alt="" className="h-36 w-36 object-contain rounded-full bg-[#FFFFFF] p-2 shadow-lg" />
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
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(EGLISE.adresse)}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-[#3A4A6E] hover:text-[#0B3BA6] transition"
                >
                  <MapPin size={16} className="text-[#0B3BA6]" /> {EGLISE.adresse}
                  <Navigation size={13} className="text-[#64769A]" />
                </a>
                <a href={`tel:${EGLISE.telephone.replace(/\s+/g, "")}`} className="flex items-center gap-2 text-[#3A4A6E] hover:text-[#0B3BA6] transition">
                  <Phone size={16} className="text-[#0B3BA6]" /> {EGLISE.telephone}
                </a>
              </div>
              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <a
                  href={`tel:${EGLISE.telephone.replace(/\s+/g, "")}`}
                  className="flex-1 text-center text-sm bg-[#0B3BA6] text-white px-4 py-2.5 rounded-sm font-medium hover:bg-[#082A7A] transition"
                >
                  Appeler l'église
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(EGLISE.adresse)}`}
                  target="_blank" rel="noreferrer"
                  className="flex-1 text-center text-sm border border-[#BFCCE6] text-[#0B3BA6] px-4 py-2.5 rounded-sm font-medium hover:border-[#0B3BA6] transition"
                >
                  Itinéraire
                </a>
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


// ---------- Page publique : comité de l'église ----------
function CarteMembre({ m }) {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square bg-[#E4EAF6]">
        {m.photo ? (
          <img src={m.photo} alt={m.nom} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-[#FFFFFF] text-4xl font-serif"
            style={{ background: "linear-gradient(135deg, #082A7A 0%, #0B3BA6 60%, #1E6FE0 100%)" }}
          >
            {initiales(m.nom)}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="font-serif text-base leading-tight">{m.nom}</div>
        <div className="text-xs text-[#64769A] mt-1">
          {m.fonction === "Responsable de département" && m.departement ? `Responsable — ${m.departement}` : m.fonction}
        </div>
      </div>
    </Card>
  );
}

function PageComite({ comite, onNavigate, onAccesResponsables }) {
  const groupes = [
    { titre: "Pasteur", filtre: (m) => m.fonction === "Pasteur" },
    { titre: "Pasteur adjoint", filtre: (m) => m.fonction === "Pasteur adjoint" },
    { titre: "Diacres", filtre: (m) => m.fonction === "Diacre" },
    { titre: "Responsables de départements", filtre: (m) => m.fonction === "Responsable de département" },
  ];
  return (
    <div className="min-h-screen bg-[#F2F6FD] text-[#0B1B45]">
      <style>{`
        .app-sans { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
        .font-serif { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 800; letter-spacing: -0.01em; }
      `}</style>
      <div className="app-sans">
        <PublicHeader courant="comite" onNavigate={onNavigate} onAccesResponsables={onAccesResponsables} />
        <section className="max-w-4xl mx-auto px-6 pt-8 pb-4">
          <h1 className="font-serif text-3xl text-[#0B3BA6]">Notre comité</h1>
          <p className="mt-3 text-[#3A4A6E] leading-relaxed max-w-xl">
            Ceux qui conduisent et servent la maison, au nom de {EGLISE.nom}.
          </p>

          {comite.length === 0 ? (
            <p className="mt-10 text-sm text-[#64769A]">Le comité sera bientôt présenté ici.</p>
          ) : (
            groupes.map((g) => {
              const membres = comite.filter(g.filtre);
              if (membres.length === 0) return null;
              return (
                <div key={g.titre} className="mt-10">
                  <h2 className="font-serif text-lg mb-4 pb-2 border-b-2 border-[#D81B1B] inline-block">{g.titre}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {membres.map((m) => <CarteMembre key={m.id} m={m} />)}
                  </div>
                </div>
              );
            })
          )}
        </section>
        <footer className="max-w-4xl mx-auto px-6 py-10 mt-6 text-xs text-[#64769A]">
          {EGLISE.nom} — {EGLISE.temple}
        </footer>
      </div>
    </div>
  );
}


// ---------- Page publique : enseignements & prédications ----------
function CartePredication({ e }) {
  const idv = idYoutube(e.video_url);
  return (
    <Card className="overflow-hidden">
      {e.type === "video" && idv ? (
        <div className="aspect-video bg-black">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${idv}`}
            title={e.titre}
            allowFullScreen
          />
        </div>
      ) : e.type === "video" ? (
        <a href={e.video_url} target="_blank" rel="noreferrer" className="aspect-video bg-[#0B1B45] flex flex-col items-center justify-center gap-2 text-[#FFFFFF]">
          <PlayCircle size={40} />
          <span className="text-xs">Regarder la vidéo</span>
        </a>
      ) : (
        <div className="aspect-video bg-[#E4EAF6] flex items-center justify-center text-[#0B3BA6]">
          <Mic size={36} />
        </div>
      )}
      <div className="p-5">
        <div className="text-xs text-[#64769A]">
          {new Date(e.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          {e.predicateur ? ` — ${e.predicateur}` : ""}
        </div>
        <h3 className="font-serif text-lg mt-1">{e.titre}</h3>
        {e.texte && <p className="text-sm text-[#3A4A6E] mt-2 leading-relaxed whitespace-pre-line">{e.texte}</p>}
      </div>
    </Card>
  );
}

function PageEnseignements({ enseignements, onNavigate, onAccesResponsables }) {
  return (
    <div className="min-h-screen bg-[#F2F6FD] text-[#0B1B45]">
      <style>{`
        .app-sans { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
        .font-serif { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 800; letter-spacing: -0.01em; }
      `}</style>
      <div className="app-sans">
        <PublicHeader courant="enseignements" onNavigate={onNavigate} onAccesResponsables={onAccesResponsables} />
        <section className="max-w-4xl mx-auto px-6 pt-8 pb-4">
          <h1 className="font-serif text-3xl text-[#0B3BA6]">Enseignements & prédications</h1>
          <p className="mt-3 text-[#3A4A6E] leading-relaxed max-w-xl">
            Retrouve ici la Parole partagée à {EGLISE.temple}, en texte ou en vidéo.
          </p>

          {enseignements.length === 0 ? (
            <div className="mt-10 bg-white border border-[#D3DDF0] rounded-sm p-8 text-center">
              <Mic size={28} className="mx-auto text-[#0B3BA6]" />
              <p className="mt-3 text-sm text-[#3A4A6E]">
                Les prochains enseignements seront bientôt disponibles.
              </p>
              <p className="mt-1 text-sm text-[#64769A]">
                En attendant, consulte les jours de culte ou contacte directement l'église.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid sm:grid-cols-2 gap-6">
              {[...enseignements].sort((a, b) => (a.date < b.date ? 1 : -1)).map((e) => <CartePredication key={e.id} e={e} />)}
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
            <img src="/logo.jpg" alt="" className="h-12 w-12 object-contain" />
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
  const [prenom, setPrenom] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [telephone, setTelephone] = useState("");
  const [quartier, setQuartier] = useState("");
  const [baptiseEau, setBaptiseEau] = useState(false);
  const [dateBaptiseEau, setDateBaptiseEau] = useState("");
  const [baptiseSaintEsprit, setBaptiseSaintEsprit] = useState(false);
  const [dateBaptiseSaintEsprit, setDateBaptiseSaintEsprit] = useState("");
  const [deps, setDeps] = useState([]);
  const [mins, setMins] = useState([]);
  const [membreOuvert, setMembreOuvert] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [filtreDept, setFiltreDept] = useState("tous");
  const [aSupprimer, setASupprimer] = useState(null);
  const [enEdition, setEnEdition] = useState(null);
  const [dateP, setDateP] = useState(todayStr());
  const [hommes, setHommes] = useState("");
  const [femmes, setFemmes] = useState("");
  const [jeunes, setJeunes] = useState("");
  const [enfants, setEnfants] = useState("");
  const [erreur, setErreur] = useState("");

  const toggleDep = (d) => setDeps((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const toggleMin = (m) => setMins((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  function reinitialiserFormMembre() {
    setNom(""); setPrenom(""); setDateNaissance(""); setTelephone(""); setQuartier("");
    setBaptiseEau(false); setDateBaptiseEau(""); setBaptiseSaintEsprit(false); setDateBaptiseSaintEsprit("");
    setDeps([]); setMins([]); setEnEdition(null);
  }

  function modifierMembre(m) {
    setNom(m.nom || ""); setPrenom(m.prenom || ""); setDateNaissance(m.date_naissance || "");
    setTelephone(m.telephone || ""); setQuartier(m.quartier || "");
    setBaptiseEau(!!m.baptise_eau); setDateBaptiseEau(m.date_baptise_eau || "");
    setBaptiseSaintEsprit(!!m.baptise_saint_esprit); setDateBaptiseSaintEsprit(m.date_baptise_saint_esprit || "");
    setDeps(m.departements || []); setMins(m.ministeres || []);
    setEnEdition(m.id);
  }

  async function ajouterMembre(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    const payload = {
      nom: nom.trim(),
      prenom: prenom.trim(),
      date_naissance: dateNaissance || null,
      telephone: telephone.trim(),
      quartier: quartier.trim(),
      baptise_eau: baptiseEau,
      date_baptise_eau: baptiseEau ? dateBaptiseEau || null : null,
      baptise_saint_esprit: baptiseSaintEsprit,
      date_baptise_saint_esprit: baptiseSaintEsprit ? dateBaptiseSaintEsprit || null : null,
      departements: deps, ministeres: mins,
    };
    try {
      if (enEdition) {
        const maj = await sbUpdate("membres", token, enEdition, payload);
        setMembres((cur) => cur.map((m) => (m.id === enEdition ? maj : m)));
      } else {
        const nouveau = await sbInsert("membres", token, payload);
        setMembres((cur) => [...cur, nouveau]);
      }
      reinitialiserFormMembre();
    } catch (err) { setErreur(err.message); }
  }

  async function supprimerMembre(id) {
    try {
      await sbDelete("membres", token, id);
      setMembres((cur) => cur.filter((m) => m.id !== id));
    } catch (err) { setErreur(err.message); }
    setASupprimer(null);
  }

  const membresFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return membres.filter((m) => {
      const correspondRecherche = !q || [m.nom, m.prenom, m.telephone, m.quartier].filter(Boolean).some((v) => v.toLowerCase().includes(q));
      const correspondDept = filtreDept === "tous" || (m.departements || []).includes(filtreDept) || (m.ministeres || []).includes(filtreDept);
      return correspondRecherche && correspondDept;
    });
  }, [membres, recherche, filtreDept]);

  const comptesParDepartement = useMemo(() => {
    const map = {};
    for (const d of [...DEPARTEMENTS, ...MINISTERES]) map[d] = 0;
    for (const m of membres) {
      for (const d of [...(m.departements || []), ...(m.ministeres || [])]) {
        map[d] = (map[d] || 0) + 1;
      }
    }
    return map;
  }, [membres]);

  function exporterMembres() {
    exporterCSV("membres.csv", membresFiltres, [
      { label: "Nom", valeur: (m) => m.nom },
      { label: "Prénom", valeur: (m) => m.prenom || "" },
      { label: "Date de naissance", valeur: (m) => (m.date_naissance ? new Date(m.date_naissance).toLocaleDateString("fr-FR") : "") },
      { label: "Téléphone", valeur: (m) => m.telephone || "" },
      { label: "Quartier", valeur: (m) => m.quartier || "" },
      { label: "Baptisé d'eau", valeur: (m) => (m.baptise_eau ? "Oui" : "Non") },
      { label: "Baptisé du Saint-Esprit", valeur: (m) => (m.baptise_saint_esprit ? "Oui" : "Non") },
      { label: "Départements", valeur: (m) => (m.departements || []).join(", ") },
      { label: "Ministères", valeur: (m) => (m.ministeres || []).join(", ") },
    ]);
  }

  async function ajouterPresence(e) {
    e.preventDefault();
    if (!hommes && !femmes && !jeunes && !enfants) return;
    try {
      const nouveau = await sbInsert("presences", token, {
        date: dateP, hommes: Number(hommes) || 0, femmes: Number(femmes) || 0, jeunes: Number(jeunes) || 0, enfants: Number(enfants) || 0,
      });
      setPresences((cur) => [...cur, nouveau]);
      setHommes(""); setFemmes(""); setJeunes(""); setEnfants("");
    } catch (err) { setErreur(err.message); }
  }

  const statsMensuelles = useMemo(() => {
    const map = {};
    for (const p of presences) {
      const key = moisKey(p.date);
      if (!map[key]) map[key] = { key, label: moisLabel(p.date), hommes: 0, femmes: 0, jeunes: 0, enfants: 0 };
      map[key].hommes += p.hommes; map[key].femmes += p.femmes; map[key].jeunes += p.jeunes; map[key].enfants += p.enfants || 0;
    }
    return Object.values(map).sort((a, b) => (a.key > b.key ? 1 : -1));
  }, [presences]);

  const dernierePresence = presences[presences.length - 1];
  const derniereTotal = dernierePresence ? dernierePresence.hommes + dernierePresence.femmes + dernierePresence.jeunes + (dernierePresence.enfants || 0) : 0;

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
          <h3 className="font-serif text-lg text-[#0B1B45] mb-4">{enEdition ? "Modifier le membre" : "Ajouter un membre"}</h3>
          <form onSubmit={ajouterMembre} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <TextField label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Mbala" />
              <TextField label="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Ex : Grace" />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <TextField label="Date de naissance" type="date" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} />
              <TextField label="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Ex : 97 00 00 00" />
              <TextField label="Quartier" value={quartier} onChange={(e) => setQuartier(e.target.value)} placeholder="Ex : Dokparou" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="inline-flex items-center gap-2 text-sm text-[#3A4A6E] font-medium">
                  <input type="checkbox" checked={baptiseEau} onChange={(e) => setBaptiseEau(e.target.checked)} className="accent-[#0B3BA6]" />
                  Baptisé d'eau
                </label>
                {baptiseEau && (
                  <input type="date" value={dateBaptiseEau} onChange={(e) => setDateBaptiseEau(e.target.value)}
                    className="mt-2 w-full border border-[#BFCCE6] bg-white rounded-sm px-3 py-2 text-[#0B1B45] focus:outline-none focus:ring-2 focus:ring-[#0B3BA6] focus:border-transparent" />
                )}
              </div>
              <div>
                <label className="inline-flex items-center gap-2 text-sm text-[#3A4A6E] font-medium">
                  <input type="checkbox" checked={baptiseSaintEsprit} onChange={(e) => setBaptiseSaintEsprit(e.target.checked)} className="accent-[#0B3BA6]" />
                  Baptisé du Saint-Esprit
                </label>
                {baptiseSaintEsprit && (
                  <input type="date" value={dateBaptiseSaintEsprit} onChange={(e) => setDateBaptiseSaintEsprit(e.target.value)}
                    className="mt-2 w-full border border-[#BFCCE6] bg-white rounded-sm px-3 py-2 text-[#0B1B45] focus:outline-none focus:ring-2 focus:ring-[#0B3BA6] focus:border-transparent" />
                )}
              </div>
            </div>
            <CheckboxGroup label="Département d'appartenance" options={DEPARTEMENTS} selected={deps} onToggle={toggleDep} />
            <CheckboxGroup label="Département(s) ministériel(s)" options={MINISTERES} selected={mins} onToggle={toggleMin} />
            <div className="flex gap-2">
              <button type="submit" className="inline-flex items-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition">
                <Plus size={16} /> {enEdition ? "Mettre à jour" : "Ajouter le membre"}
              </button>
              {enEdition && (
                <button type="button" onClick={reinitialiserFormMembre} className="text-sm px-4 py-2 rounded-sm border border-[#BFCCE6] text-[#3A4A6E] hover:border-[#0B3BA6] transition">
                  Annuler
                </button>
              )}
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Comptage du dimanche</h3>
          <form onSubmit={ajouterPresence} className="space-y-4">
            <TextField label="Date du culte" type="date" value={dateP} onChange={(e) => setDateP(e.target.value)} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <TextField label="Hommes" type="number" min="0" value={hommes} onChange={(e) => setHommes(e.target.value)} />
              <TextField label="Femmes" type="number" min="0" value={femmes} onChange={(e) => setFemmes(e.target.value)} />
              <TextField label="Jeunes" type="number" min="0" value={jeunes} onChange={(e) => setJeunes(e.target.value)} />
              <TextField label="Enfants" type="number" min="0" value={enfants} onChange={(e) => setEnfants(e.target.value)} />
            </div>
            <button type="submit" className="inline-flex items-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition">
              <Plus size={16} /> Enregistrer le comptage
            </button>
          </form>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Répartition par département</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...DEPARTEMENTS, ...MINISTERES].map((d) => (
            <div key={d} className="bg-[#F2F6FD] rounded-sm p-3">
              <div className="text-2xl font-serif text-[#0B3BA6]">{comptesParDepartement[d] || 0}</div>
              <div className="text-xs text-[#3A4A6E] mt-0.5">{d}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="font-serif text-lg text-[#0B1B45]">Registre des membres</h3>
          <span className="text-xs text-[#64769A]">{membresFiltres.length} / {membres.length}</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2">
            <TextField
              label="Rechercher (nom, prénom, téléphone, quartier)"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Ex : Grace, 97 00, Dokparou..."
            />
          </div>
          <SelectField label="Département" value={filtreDept} onChange={(e) => setFiltreDept(e.target.value)}>
            <option value="tous">Tous</option>
            {[...DEPARTEMENTS, ...MINISTERES].map((d) => <option key={d} value={d}>{d}</option>)}
          </SelectField>
        </div>
        <button
          onClick={exporterMembres}
          disabled={membresFiltres.length === 0}
          className="mt-3 inline-flex items-center gap-2 text-sm border border-[#BFCCE6] px-4 py-2 rounded-sm text-[#3A4A6E] hover:border-[#0B3BA6] hover:text-[#0B3BA6] transition disabled:opacity-50"
        >
          <Download size={15} /> Exporter en CSV
        </button>
        {membres.length === 0 ? (
          <p className="text-sm text-[#64769A] mt-4">Aucun membre enregistré pour le moment.</p>
        ) : membresFiltres.length === 0 ? (
          <p className="text-sm text-[#64769A] mt-4">Aucun membre ne correspond à cette recherche.</p>
        ) : (
          <div className="divide-y divide-[#E4EAF6] mt-4">
            {membresFiltres.map((m) => {
              const ouvert = membreOuvert === m.id;
              return (
                <div key={m.id} className="py-3">
                  <div className="flex items-start justify-between gap-4">
                    <button className="text-left flex-1" onClick={() => setMembreOuvert(ouvert ? null : m.id)}>
                      <div className="font-medium text-[#0B1B45]">{[m.prenom, m.nom].filter(Boolean).join(" ") || m.nom}</div>
                      <div className="text-xs text-[#64769A] mt-1">{[...(m.departements || []), ...(m.ministeres || [])].join(" · ") || "Aucun département renseigné"}</div>
                    </button>
                    <button onClick={() => modifierMembre(m)} className="text-[#64769A] hover:text-[#0B3BA6] transition shrink-0"><Pencil size={16} /></button>
                    <button onClick={() => setASupprimer(m.id)} className="text-[#64769A] hover:text-[#D81B1B] transition shrink-0"><Trash2 size={16} /></button>
                  </div>
                  {ouvert && (
                    <div className="mt-2 ml-0 text-xs text-[#3A4A6E] space-y-1 bg-[#F2F6FD] rounded-sm p-3">
                      {m.date_naissance && <div>Né(e) le {new Date(m.date_naissance).toLocaleDateString("fr-FR")}</div>}
                      {m.telephone && <div>Téléphone : {m.telephone}</div>}
                      {m.quartier && <div>Quartier : {m.quartier}</div>}
                      <div>Baptisé d'eau : {m.baptise_eau ? `Oui${m.date_baptise_eau ? " — " + new Date(m.date_baptise_eau).toLocaleDateString("fr-FR") : ""}` : "Non"}</div>
                      <div>Baptisé du Saint-Esprit : {m.baptise_saint_esprit ? `Oui${m.date_baptise_saint_esprit ? " — " + new Date(m.date_baptise_saint_esprit).toLocaleDateString("fr-FR") : ""}` : "Non"}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {aSupprimer && (
        <ConfirmerSuppression
          titre="Retirer ce membre ?"
          message="Cette action est définitive et retirera aussi son historique associé."
          onAnnuler={() => setASupprimer(null)}
          onConfirmer={() => supprimerMembre(aSupprimer)}
        />
      )}

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
                <Bar dataKey="enfants" name="Enfants" fill="#1E6FE0" />
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
  const [aSupprimer, setASupprimer] = useState(null);
  const [enEdition, setEnEdition] = useState(null);
  const [type, setType] = useState("entree");
  const [date, setDate] = useState(todayStr());
  const [categorie, setCategorie] = useState(CATEGORIES_ENTREE[0]);
  const [montant, setMontant] = useState("");
  const [description, setDescription] = useState("");
  const [erreur, setErreur] = useState("");
  const [filtreMois, setFiltreMois] = useState("");
  const [filtreType, setFiltreType] = useState("tous");
  const [filtreCategorie, setFiltreCategorie] = useState("toutes");

  const categories = type === "entree" ? CATEGORIES_ENTREE : CATEGORIES_DEPENSE;
  const toutesCategories = [...new Set([...CATEGORIES_ENTREE, ...CATEGORIES_DEPENSE])];
  const moisDisponibles = useMemo(() => {
    const m = [...new Set(finances.map((f) => moisKey(f.date)))].sort().reverse();
    return m.map((k) => ({ key: k, label: finances.find((f) => moisKey(f.date) === k) ? moisLabel(finances.find((f) => moisKey(f.date) === k).date) : k }));
  }, [finances]);

  function changerType(t) {
    setType(t);
    setCategorie(t === "entree" ? CATEGORIES_ENTREE[0] : CATEGORIES_DEPENSE[0]);
  }

  function reinitialiserFormMouvement() {
    setType("entree"); setDate(todayStr()); setCategorie(CATEGORIES_ENTREE[0]);
    setMontant(""); setDescription(""); setEnEdition(null);
  }

  function modifierMouvement(f) {
    setType(f.type); setDate(f.date); setCategorie(f.categorie);
    setMontant(String(f.montant)); setDescription(f.description || "");
    setEnEdition(f.id);
  }

  async function ajouterMouvement(e) {
    e.preventDefault();
    if (!montant) return;
    const payload = { date, type, categorie, montant: Number(montant), description: description.trim() };
    try {
      if (enEdition) {
        const maj = await sbUpdate("finances", token, enEdition, payload);
        setFinances((cur) => cur.map((f) => (f.id === enEdition ? maj : f)));
      } else {
        const nouveau = await sbInsert("finances", token, payload);
        setFinances((cur) => [...cur, nouveau]);
      }
      reinitialiserFormMouvement();
    } catch (err) { setErreur(err.message); }
  }

  async function supprimerMouvement(id) {
    try {
      await sbDelete("finances", token, id);
      setFinances((cur) => cur.filter((f) => f.id !== id));
    } catch (err) { setErreur(err.message); }
    setASupprimer(null);
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

  const mouvementsFiltres = useMemo(() => {
    return finances.filter((f) =>
      (!filtreMois || moisKey(f.date) === filtreMois) &&
      (filtreType === "tous" || f.type === filtreType) &&
      (filtreCategorie === "toutes" || f.categorie === filtreCategorie)
    );
  }, [finances, filtreMois, filtreType, filtreCategorie]);

  const totalEntrees = mouvementsFiltres.filter((f) => f.type === "entree").reduce((s, f) => s + Number(f.montant), 0);
  const totalDepenses = mouvementsFiltres.filter((f) => f.type === "depense").reduce((s, f) => s + Number(f.montant), 0);
  const solde = totalEntrees - totalDepenses;
  const mouvementsTries = [...mouvementsFiltres].sort((a, b) => (a.date < b.date ? 1 : -1));
  const filtresActifs = filtreMois || filtreType !== "tous" || filtreCategorie !== "toutes";

  function exporterMouvements() {
    exporterCSV(`finances${filtreMois ? "-" + filtreMois : ""}.csv`, mouvementsTries, [
      { label: "Date", valeur: (f) => new Date(f.date).toLocaleDateString("fr-FR") },
      { label: "Type", valeur: (f) => (f.type === "entree" ? "Entrée" : "Dépense") },
      { label: "Catégorie", valeur: (f) => f.categorie },
      { label: "Montant (FCFA)", valeur: (f) => f.montant },
      { label: "Description", valeur: (f) => f.description || "" },
    ]);
  }

  function imprimerRapport() {
    const titrePeriode = filtreMois
      ? moisDisponibles.find((m) => m.key === filtreMois)?.label || filtreMois
      : "Toutes périodes";
    const lignes = mouvementsTries
      .map((f) => `<tr>
        <td>${new Date(f.date).toLocaleDateString("fr-FR")}</td>
        <td>${f.type === "entree" ? "Entrée" : "Dépense"}</td>
        <td>${f.categorie}</td>
        <td style="text-align:right">${fmtMontant(f.montant)} FCFA</td>
        <td>${f.description || ""}</td>
      </tr>`)
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bilan financier — ${titrePeriode}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#0B1B45;padding:24px;}
        h1{font-size:18px;margin-bottom:0;}
        p{color:#3A4A6E;margin-top:4px;}
        table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;}
        th,td{border-bottom:1px solid #D3DDF0;padding:6px 8px;text-align:left;}
        th{background:#F2F6FD;}
        .totaux{margin-top:16px;font-size:14px;}
        .totaux div{margin-bottom:4px;}
      </style></head><body>
      <h1>${EGLISE.nom} — ${EGLISE.temple}</h1>
      <p>Bilan financier — ${titrePeriode}</p>
      <table><thead><tr><th>Date</th><th>Type</th><th>Catégorie</th><th style="text-align:right">Montant</th><th>Description</th></tr></thead>
      <tbody>${lignes}</tbody></table>
      <div class="totaux">
        <div><strong>Total des entrées :</strong> ${fmtMontant(totalEntrees)} FCFA</div>
        <div><strong>Total des dépenses :</strong> ${fmtMontant(totalDepenses)} FCFA</div>
        <div><strong>Solde :</strong> ${solde >= 0 ? "+" : ""}${fmtMontant(solde)} FCFA</div>
      </div>
      </body></html>`;
    const fenetre = window.open("", "_blank");
    if (!fenetre) { setErreur("Autorise les fenêtres pop-up pour imprimer le rapport."); return; }
    fenetre.document.write(html);
    fenetre.document.close();
    fenetre.onload = () => fenetre.print();
  }

  return (
    <div className="space-y-8">
      {erreur && <p className="text-sm text-[#0B3BA6]">{erreur}</p>}

      <Card className="p-4">
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <SelectField label="Mois" value={filtreMois} onChange={(e) => setFiltreMois(e.target.value)}>
            <option value="">Tous les mois</option>
            {moisDisponibles.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </SelectField>
          <SelectField label="Type" value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
            <option value="tous">Entrées et dépenses</option>
            <option value="entree">Entrées seulement</option>
            <option value="depense">Dépenses seulement</option>
          </SelectField>
          <SelectField label="Catégorie" value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)}>
            <option value="toutes">Toutes les catégories</option>
            {toutesCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectField>
          <button
            onClick={exporterMouvements}
            disabled={mouvementsTries.length === 0}
            className="inline-flex items-center justify-center gap-2 text-sm border border-[#BFCCE6] px-4 py-2 rounded-sm text-[#3A4A6E] hover:border-[#0B3BA6] hover:text-[#0B3BA6] transition disabled:opacity-50"
          >
            <Download size={15} /> Exporter en CSV
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatBlock label={filtresActifs ? "Entrées (filtrées)" : "Total des entrées"} value={`${fmtMontant(totalEntrees)} FCFA`} />
        <StatBlock label={filtresActifs ? "Dépenses (filtrées)" : "Total des dépenses"} value={`${fmtMontant(totalDepenses)} FCFA`} />
        <StatBlock label="Solde" value={`${solde >= 0 ? "+" : ""}${fmtMontant(solde)} FCFA`} />
      </div>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">{enEdition ? "Modifier le mouvement" : "Enregistrer un mouvement"}</h3>
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
            <TextField label="Montant (FCFA)" type="number" min="0" step="1" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0" />
          </div>
          <TextField label="Description (facultatif)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex : Câbles sono, projet toiture..." />
          <div className="flex gap-2">
            <button type="submit" className="inline-flex items-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition">
              <Plus size={16} /> {enEdition ? "Mettre à jour" : "Enregistrer"}
            </button>
            {enEdition && (
              <button type="button" onClick={reinitialiserFormMouvement} className="text-sm px-4 py-2 rounded-sm border border-[#BFCCE6] text-[#3A4A6E] hover:border-[#0B3BA6] transition">
                Annuler
              </button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Journal des mouvements{filtresActifs ? " (filtré)" : ""}</h3>
        {mouvementsTries.length === 0 ? (
          <p className="text-sm text-[#64769A]">{filtresActifs ? "Aucun mouvement ne correspond à ce filtre." : "Aucun mouvement enregistré pour le moment."}</p>
        ) : (
          <div className="divide-y divide-[#E4EAF6]">
            {mouvementsTries.map((f) => (
              <div key={f.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-[#0B1B45]">{f.categorie}{f.description && <span className="text-[#64769A]"> — {f.description}</span>}</div>
                  <div className="text-xs text-[#64769A] mt-0.5">{new Date(f.date).toLocaleDateString("fr-FR")}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${f.type === "entree" ? "text-[#0B3BA6]" : "text-[#D81B1B]"}`}>{f.type === "entree" ? "+" : "-"}{fmtMontant(f.montant)} FCFA</span>
                  <button onClick={() => modifierMouvement(f)} className="text-[#64769A] hover:text-[#0B3BA6] transition"><Pencil size={16} /></button>
                  <button onClick={() => setASupprimer(f.id)} className="text-[#64769A] hover:text-[#D81B1B] transition"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {aSupprimer && (
        <ConfirmerSuppression
          titre="Supprimer ce mouvement ?"
          message="Cette opération est définitive et modifiera les totaux calculés."
          onAnnuler={() => setASupprimer(null)}
          onConfirmer={() => supprimerMouvement(aSupprimer)}
        />
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="font-serif text-lg text-[#0B1B45]">Bilan mensuel</h3>
          <button
            onClick={imprimerRapport}
            disabled={mouvementsTries.length === 0}
            className="inline-flex items-center gap-2 text-sm border border-[#BFCCE6] px-3 py-1.5 rounded-sm text-[#3A4A6E] hover:border-[#0B3BA6] hover:text-[#0B3BA6] transition disabled:opacity-50"
          >
            <Printer size={14} /> Imprimer{filtresActifs ? " le filtre" : " ce bilan"}
          </button>
        </div>
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


// ---------- Vue Enseignements (admin) ----------
function VueEnseignements({ token, enseignements, setEnseignements }) {
  const [aSupprimer, setASupprimer] = useState(null);
  const [enEdition, setEnEdition] = useState(null);
  const [type, setType] = useState("texte");
  const [titre, setTitre] = useState("");
  const [predicateur, setPredicateur] = useState("");
  const [date, setDate] = useState(todayStr());
  const [texte, setTexte] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [erreur, setErreur] = useState("");

  function reinitialiserFormEnseignement() {
    setType("texte"); setTitre(""); setPredicateur(""); setDate(todayStr());
    setTexte(""); setVideoUrl(""); setEnEdition(null);
  }

  function modifierEnseignement(e) {
    setType(e.type); setTitre(e.titre); setPredicateur(e.predicateur || ""); setDate(e.date);
    setTexte(e.texte || ""); setVideoUrl(e.video_url || "");
    setEnEdition(e.id);
  }

  async function publier(e) {
    e.preventDefault();
    if (!titre.trim()) return;
    if (type === "texte" && !texte.trim()) return;
    if (type === "video" && !videoUrl.trim()) return;
    const payload = {
      type, titre: titre.trim(), predicateur: predicateur.trim(), date,
      texte: type === "texte" ? texte.trim() : "",
      video_url: type === "video" ? videoUrl.trim() : "",
    };
    try {
      if (enEdition) {
        const maj = await sbUpdate("enseignements", token, enEdition, payload);
        setEnseignements((cur) => cur.map((x) => (x.id === enEdition ? maj : x)));
      } else {
        const nouveau = await sbInsert("enseignements", token, payload);
        setEnseignements((cur) => [...cur, nouveau]);
      }
      reinitialiserFormEnseignement(); setErreur("");
    } catch (err) { setErreur(err.message); }
  }

  async function supprimer(id) {
    try {
      await sbDelete("enseignements", token, id);
      setEnseignements((cur) => cur.filter((e) => e.id !== id));
    } catch (err) { setErreur(err.message); }
    setASupprimer(null);
  }

  return (
    <div className="space-y-8">
      {erreur && <p className="text-sm text-[#D81B1B]">{erreur}</p>}

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">{enEdition ? "Modifier l'enseignement" : "Publier un enseignement"}</h3>
        <form onSubmit={publier} className="space-y-4">
          <div className="flex gap-2">
            {[{ key: "texte", label: "Texte" }, { key: "video", label: "Vidéo" }].map((t) => (
              <button
                type="button" key={t.key} onClick={() => setType(t.key)}
                className={`flex-1 text-sm py-2 rounded-sm border transition ${type === t.key ? "bg-[#0B3BA6] border-[#0B3BA6] text-[#FFFFFF]" : "bg-white border-[#BFCCE6] text-[#3A4A6E]"}`}
              >{t.label}</button>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <TextField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex : La foi qui déplace les montagnes" />
            <TextField label="Prédicateur (facultatif)" value={predicateur} onChange={(e) => setPredicateur(e.target.value)} placeholder="Ex : Pasteur Jean Dossou" />
            <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {type === "texte" ? (
            <label className="block text-sm">
              <span className="text-[#3A4A6E] font-medium">Contenu de l'enseignement</span>
              <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={6} placeholder="Écris ou colle le texte de la prédication..."
                className="mt-1 w-full border border-[#BFCCE6] bg-white rounded-sm px-3 py-2 text-[#0B1B45] focus:outline-none focus:ring-2 focus:ring-[#0B3BA6] focus:border-transparent" />
            </label>
          ) : (
            <TextField label="Lien de la vidéo (YouTube ou autre)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
          )}
          <div className="flex gap-2">
            <button type="submit" className="inline-flex items-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition">
              <Plus size={16} /> {enEdition ? "Mettre à jour" : "Publier"}
            </button>
            {enEdition && (
              <button type="button" onClick={reinitialiserFormEnseignement} className="text-sm px-4 py-2 rounded-sm border border-[#BFCCE6] text-[#3A4A6E] hover:border-[#0B3BA6] transition">
                Annuler
              </button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Enseignements publiés</h3>
        {enseignements.length === 0 ? (
          <p className="text-sm text-[#64769A]">Rien n'a encore été publié.</p>
        ) : (
          <div className="divide-y divide-[#E4EAF6]">
            {[...enseignements].sort((a, b) => (a.date < b.date ? 1 : -1)).map((e) => (
              <div key={e.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-[#0B1B45]">{e.titre}</div>
                  <div className="text-xs text-[#64769A]">
                    {e.type === "video" ? "Vidéo" : "Texte"} — {new Date(e.date).toLocaleDateString("fr-FR")}
                    {e.predicateur ? ` — ${e.predicateur}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => modifierEnseignement(e)} className="text-[#64769A] hover:text-[#0B3BA6] transition"><Pencil size={16} /></button>
                  <button onClick={() => setASupprimer(e.id)} className="text-[#64769A] hover:text-[#D81B1B] transition"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {aSupprimer && (
        <ConfirmerSuppression
          titre="Supprimer cet enseignement ?"
          message="Il ne sera plus visible sur le site public."
          onAnnuler={() => setASupprimer(null)}
          onConfirmer={() => supprimer(aSupprimer)}
        />
      )}
    </div>
  );
}


// ---------- Vue Comité (admin) ----------
function VueComite({ token, comite, setComite }) {
  const [aSupprimer, setASupprimer] = useState(null);
  const [enEdition, setEnEdition] = useState(null);
  const [nom, setNom] = useState("");
  const [fonction, setFonction] = useState(FONCTIONS_COMITE[0]);
  const [departement, setDepartement] = useState("");
  const [photo, setPhoto] = useState(null);
  const [erreur, setErreur] = useState("");

  async function choisirPhoto(file, apres) {
    try {
      apres(await envoyerImage(token, file, "comite", 600));
    } catch (err) {
      setErreur("Image illisible ou échec de l'envoi.");
    }
  }

  function reinitialiserFormComite() {
    setNom(""); setFonction(FONCTIONS_COMITE[0]); setDepartement(""); setPhoto(null); setEnEdition(null);
  }

  function modifier(m) {
    setNom(m.nom); setFonction(m.fonction); setDepartement(m.departement || ""); setPhoto(m.photo || null);
    setEnEdition(m.id);
  }

  async function ajouter(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    const payload = {
      nom: nom.trim(),
      fonction,
      departement: fonction === "Responsable de département" ? departement.trim() : "",
      photo,
    };
    try {
      if (enEdition) {
        const maj = await sbUpdate("comite", token, enEdition, payload);
        setComite((cur) => cur.map((m) => (m.id === enEdition ? maj : m)));
      } else {
        const nouveau = await sbInsert("comite", token, payload);
        setComite((cur) => [...cur, nouveau]);
      }
      reinitialiserFormComite(); setErreur("");
    } catch (err) { setErreur(err.message); }
  }

  async function supprimer(id) {
    try {
      await sbDelete("comite", token, id);
      setComite((cur) => cur.filter((m) => m.id !== id));
    } catch (err) { setErreur(err.message); }
    setASupprimer(null);
  }

  async function remplacerPhoto(id, dataUrl) {
    try {
      const maj = await sbUpdate("comite", token, id, { photo: dataUrl });
      setComite((cur) => cur.map((m) => (m.id === id ? { ...m, photo: maj.photo } : m)));
    } catch (err) { setErreur(err.message); }
  }

  return (
    <div className="space-y-8">
      {erreur && <p className="text-sm text-[#D81B1B]">{erreur}</p>}

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">{enEdition ? "Modifier ce membre du comité" : "Ajouter au comité"}</h3>
        <form onSubmit={ajouter} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField label="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Pasteur Jean Dossou" />
            <SelectField label="Fonction" value={fonction} onChange={(e) => setFonction(e.target.value)}>
              {FONCTIONS_COMITE.map((f) => <option key={f} value={f}>{f}</option>)}
            </SelectField>
          </div>
          {fonction === "Responsable de département" && (
            <div>
              <TextField label="Département" list="liste-departements" value={departement} onChange={(e) => setDepartement(e.target.value)} placeholder="Ex : Chorale / Louange" />
              <datalist id="liste-departements">
                {[...DEPARTEMENTS, ...MINISTERES].map((d) => <option key={d} value={d} />)}
              </datalist>
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-sm overflow-hidden border border-[#D3DDF0] bg-[#E4EAF6] flex items-center justify-center text-xs text-[#64769A]">
              {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : "Photo"}
            </div>
            <label className="inline-flex items-center gap-2 text-sm border border-[#BFCCE6] px-3 py-2 rounded-sm text-[#3A4A6E] cursor-pointer hover:border-[#0B3BA6] hover:text-[#0B3BA6] transition">
              <Camera size={14} /> Choisir une photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) choisirPhoto(file, setPhoto);
              }} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="inline-flex items-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition">
              <Plus size={16} /> {enEdition ? "Mettre à jour" : "Ajouter"}
            </button>
            {enEdition && (
              <button type="button" onClick={reinitialiserFormComite} className="text-sm px-4 py-2 rounded-sm border border-[#BFCCE6] text-[#3A4A6E] hover:border-[#0B3BA6] transition">
                Annuler
              </button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">Membres du comité</h3>
        {comite.length === 0 ? (
          <p className="text-sm text-[#64769A]">Personne n'a encore été ajouté.</p>
        ) : (
          <div className="divide-y divide-[#E4EAF6]">
            {comite.map((m) => (
              <div key={m.id} className="py-3 flex items-center gap-4">
                <div className="w-14 h-14 rounded-sm overflow-hidden bg-[#E4EAF6] shrink-0 flex items-center justify-center text-sm text-[#64769A]">
                  {m.photo ? <img src={m.photo} alt="" className="w-full h-full object-cover" /> : initiales(m.nom)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#0B1B45] truncate">{m.nom}</div>
                  <div className="text-xs text-[#64769A]">
                    {m.fonction}{m.departement ? ` — ${m.departement}` : ""}
                  </div>
                </div>
                <button onClick={() => modifier(m)} className="text-[#64769A] hover:text-[#0B3BA6] transition shrink-0"><Pencil size={16} /></button>
                <label className="text-xs text-[#0B3BA6] cursor-pointer hover:underline">
                  Changer la photo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) choisirPhoto(file, (d) => remplacerPhoto(m.id, d));
                  }} />
                </label>
                <button onClick={() => setASupprimer(m.id)} className="text-[#64769A] hover:text-[#D81B1B] transition"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {aSupprimer && (
        <ConfirmerSuppression
          titre="Retirer cette personne du comité ?"
          message="Elle ne sera plus affichée sur la page publique."
          onAnnuler={() => setASupprimer(null)}
          onConfirmer={() => supprimer(aSupprimer)}
        />
      )}
    </div>
  );
}


// ---------- Vue Site & Annonces ----------
function VueSite({ token, siteInfo, setSiteInfo, horaires, setHoraires, annonces, setAnnonces }) {
  const [horaireASupprimer, setHoraireASupprimer] = useState(null);
  const [annonceASupprimer, setAnnonceASupprimer] = useState(null);
  const [horaireEnEdition, setHoraireEnEdition] = useState(null);
  const [annonceEnEdition, setAnnonceEnEdition] = useState(null);
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

  function reinitialiserFormHoraire() {
    setJour(""); setHeure(""); setActivite(""); setHoraireEnEdition(null);
  }

  function modifierHoraire(h) {
    setJour(h.jour); setHeure(h.heure); setActivite(h.activite || "");
    setHoraireEnEdition(h.id);
  }

  async function ajouterHoraire(e) {
    e.preventDefault();
    if (!jour.trim() || !heure.trim()) return;
    const payload = { jour: jour.trim(), heure: heure.trim(), activite: activite.trim() };
    try {
      if (horaireEnEdition) {
        const maj = await sbUpdate("horaires", token, horaireEnEdition, payload);
        setHoraires((cur) => cur.map((h) => (h.id === horaireEnEdition ? maj : h)));
      } else {
        const nouveau = await sbInsert("horaires", token, payload);
        setHoraires((cur) => [...cur, nouveau]);
      }
      reinitialiserFormHoraire();
    } catch (err) { setErreur(err.message); }
  }

  async function supprimerHoraire(id) {
    try {
      await sbDelete("horaires", token, id);
      setHoraires((cur) => cur.filter((h) => h.id !== id));
    } catch (err) { setErreur(err.message); }
    setHoraireASupprimer(null);
  }

  function reinitialiserFormAnnonce() {
    setTitre(""); setDateAnnonce(todayStr()); setTexte(""); setImage(null); setAnnonceEnEdition(null);
  }

  function modifierAnnonce(a) {
    setTitre(a.titre); setDateAnnonce(a.date); setTexte(a.texte || ""); setImage(a.image || null);
    setAnnonceEnEdition(a.id);
  }

  async function ajouterAnnonce(e) {
    e.preventDefault();
    if (!titre.trim() || !texte.trim()) return;
    const payload = { titre: titre.trim(), date: dateAnnonce, texte: texte.trim(), image };
    try {
      if (annonceEnEdition) {
        const maj = await sbUpdate("annonces", token, annonceEnEdition, payload);
        setAnnonces((cur) => cur.map((a) => (a.id === annonceEnEdition ? maj : a)));
      } else {
        const nouveau = await sbInsert("annonces", token, payload);
        setAnnonces((cur) => [...cur, nouveau]);
      }
      reinitialiserFormAnnonce();
    } catch (err) { setErreur(err.message); }
  }

  async function supprimerAnnonce(id) {
    try {
      await sbDelete("annonces", token, id);
      setAnnonces((cur) => cur.filter((a) => a.id !== id));
    } catch (err) { setErreur(err.message); }
    setAnnonceASupprimer(null);
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
              envoyerImage(token, file, "site", 1400).then(changerPhoto).catch(() => setErreur("Échec de l'envoi de l'image."));
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
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => modifierHoraire(h)} className="text-[#64769A] hover:text-[#0B3BA6] transition"><Pencil size={16} /></button>
                <button onClick={() => setHoraireASupprimer(h.id)} className="text-[#64769A] hover:text-[#D81B1B] transition"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={ajouterHoraire} className="grid sm:grid-cols-4 gap-3 items-end">
          <TextField label="Jour" value={jour} onChange={(e) => setJour(e.target.value)} placeholder="Ex : Vendredi" />
          <TextField label="Horaire" value={heure} onChange={(e) => setHeure(e.target.value)} placeholder="Ex : 18h00 – 20h00" />
          <TextField label="Activité" value={activite} onChange={(e) => setActivite(e.target.value)} placeholder="Ex : Veillée de prière" />
          <div className="flex gap-2">
            <button type="submit" className="inline-flex items-center justify-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition h-fit">
              <Plus size={16} /> {horaireEnEdition ? "Mettre à jour" : "Ajouter"}
            </button>
            {horaireEnEdition && (
              <button type="button" onClick={reinitialiserFormHoraire} className="text-sm px-4 py-2 rounded-sm border border-[#BFCCE6] text-[#3A4A6E] hover:border-[#0B3BA6] transition h-fit">
                Annuler
              </button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-lg text-[#0B1B45] mb-4">{annonceEnEdition ? "Modifier l'annonce" : "Publier une annonce"}</h3>
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
              envoyerImage(token, file, "annonces", 1000).then(setImage).catch(() => setErreur("Échec de l'envoi de l'image."));
            }} className="mt-1 block w-full text-sm text-[#3A4A6E]" />
          </label>
          {image && annonceEnEdition && (
            <div className="text-xs text-[#64769A]">Une affiche est déjà associée ; choisis un fichier pour la remplacer.</div>
          )}
          <div className="flex gap-2">
            <button type="submit" className="inline-flex items-center gap-2 bg-[#0B3BA6] text-[#FFFFFF] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#082A7A] transition">
              <Plus size={16} /> {annonceEnEdition ? "Mettre à jour" : "Publier l'annonce"}
            </button>
            {annonceEnEdition && (
              <button type="button" onClick={reinitialiserFormAnnonce} className="text-sm px-4 py-2 rounded-sm border border-[#BFCCE6] text-[#3A4A6E] hover:border-[#0B3BA6] transition">
                Annuler
              </button>
            )}
          </div>
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
                <div className="flex items-center gap-3 shrink-0"><button onClick={() => modifierAnnonce(a)} className="text-[#64769A] hover:text-[#0B3BA6] transition"><Pencil size={16} /></button><button onClick={() => setAnnonceASupprimer(a.id)} className="text-[#64769A] hover:text-[#D81B1B] transition"><Trash2 size={16} /></button></div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {horaireASupprimer && (
        <ConfirmerSuppression
          titre="Supprimer ce jour de culte ?"
          message="Il disparaîtra de la page publique."
          onAnnuler={() => setHoraireASupprimer(null)}
          onConfirmer={() => supprimerHoraire(horaireASupprimer)}
        />
      )}
      {annonceASupprimer && (
        <ConfirmerSuppression
          titre="Supprimer cette annonce ?"
          message="Elle disparaîtra de la page publique."
          onAnnuler={() => setAnnonceASupprimer(null)}
          onConfirmer={() => supprimerAnnonce(annonceASupprimer)}
        />
      )}
    </div>
  );
}


// ---------- Vue d'ensemble ----------
function VueEnsemble({ membres, presences, finances }) {
  const totalEntrees = finances.filter((f) => f.type === "entree").reduce((s, f) => s + Number(f.montant), 0);
  const totalDepenses = finances.filter((f) => f.type === "depense").reduce((s, f) => s + Number(f.montant), 0);
  const dernierePresence = presences[presences.length - 1];
  const derniereTotal = dernierePresence ? dernierePresence.hommes + dernierePresence.femmes + dernierePresence.jeunes + (dernierePresence.enfants || 0) : 0;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatBlock label="Membres enregistrés" value={membres.length} />
      <StatBlock label="Dernier comptage" value={derniereTotal} sub={dernierePresence ? new Date(dernierePresence.date).toLocaleDateString("fr-FR") : "—"} />
      <StatBlock label="Total entrées (cumulé)" value={`${fmtMontant(totalEntrees)} FCFA`} />
      <StatBlock label="Solde cumulé" value={`${fmtMontant(totalEntrees - totalDepenses)} FCFA`} />
    </div>
  );
}


// ---------- Application principale ----------
export default function GestionEglise() {
  const [page, setPage] = useState("public"); // "public" | "comite" | "connexion" | "admin"
  const [onglet, setOnglet] = useState("ensemble");
  const [session, setSession] = useState(null); // { token, role, email }
  const [chargementPublic, setChargementPublic] = useState(true);
  const [chargementAdmin, setChargementAdmin] = useState(false);
  const [erreurGlobale, setErreurGlobale] = useState("");

  const [siteInfo, setSiteInfo] = useState({ id: 1, presentation: "", photo: null });
  const [horaires, setHoraires] = useState([]);
  const [annonces, setAnnonces] = useState([]);
  const [comite, setComite] = useState([]);
  const [enseignements, setEnseignements] = useState([]);
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

  // Le comité est chargé à part : si la table n'existe pas encore, l'accueil reste intact
  useEffect(() => {
    (async () => {
      try {
        const c = await sbSelect("comite", null, "&order=created_at.asc");
        setComite(c || []);
      } catch (e) {}
      try {
        const en = await sbSelect("enseignements", null);
        setEnseignements(en || []);
      } catch (e) {}
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
    return <PagePublique siteInfo={siteInfo} horaires={horaires} annonces={annonces} onNavigate={setPage} onAccesResponsables={() => setPage("connexion")} />;
  }

  if (page === "comite") {
    return <PageComite comite={comite} onNavigate={setPage} onAccesResponsables={() => setPage("connexion")} />;
  }

  if (page === "enseignements") {
    return <PageEnseignements enseignements={enseignements} onNavigate={setPage} onAccesResponsables={() => setPage("connexion")} />;
  }

  if (page === "connexion") {
    return <PageConnexion onConnexion={connexion} onRetour={() => setPage("public")} />;
  }

  const tousOnglets = [
    { key: "ensemble", label: "Vue d'ensemble", icon: LayoutGrid, roles: ["admin", "finances", "effectif"] },
    { key: "effectif", label: "Effectif", icon: Users, roles: ["admin", "effectif"] },
    { key: "finances", label: "Finances", icon: Wallet, roles: ["admin", "finances"] },
    { key: "comite", label: "Comité", icon: UserCheck, roles: ["admin"] },
    { key: "enseignements", label: "Enseignements", icon: Mic, roles: ["admin"] },
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
            <img src="/logo.jpg" alt="" className="h-11 w-11 object-contain" />
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
              {onglet === "comite" && <VueComite token={session.token} comite={comite} setComite={setComite} />}
              {onglet === "enseignements" && <VueEnseignements token={session.token} enseignements={enseignements} setEnseignements={setEnseignements} />}
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
