/**
 * SessionTemplates
 * Pro feature: save, reuse, and manage session templates.
 * Stored in auth user_metadata.session_templates — no DB migration required.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  FileText,
  DollarSign,
  Gift,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "sonner";

export interface SessionTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  isFree: boolean;
  price: number; // dollars
  createdAt: string;
}

function generateId() {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_FORM: Omit<SessionTemplate, "id" | "createdAt"> = {
  name: "",
  title: "",
  description: "",
  isFree: false,
  price: 25,
};

interface TemplateFormProps {
  initial?: SessionTemplate | null;
  onSave: (data: Omit<SessionTemplate, "id" | "createdAt">) => void;
  onCancel: () => void;
  saving: boolean;
}

function TemplateForm({ initial, onSave, onCancel, saving }: TemplateFormProps) {
  const [form, setForm] = useState<Omit<SessionTemplate, "id" | "createdAt">>(
    initial
      ? { name: initial.name, title: initial.title, description: initial.description, isFree: initial.isFree, price: initial.price }
      : DEFAULT_FORM
  );

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-obsidian rounded-2xl border border-electric/30 p-4 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-foreground">
          {initial ? "Edit Template" : "New Template"}
        </p>
        <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Template name (internal label) */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Template Name</label>
        <input
          className="mt-1 w-full bg-carbon border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-electric/50"
          placeholder="e.g. Weekend Workshop"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={60}
        />
      </div>

      {/* Session title */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Session Title</label>
        <input
          className="mt-1 w-full bg-carbon border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-electric/50"
          placeholder="e.g. Abstract Watercolor Techniques"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={80}
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Description</label>
        <textarea
          className="mt-1 w-full bg-carbon border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-electric/50 resize-none"
          placeholder="Session description..."
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          maxLength={500}
        />
      </div>

      {/* Pricing */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Pricing</label>
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => set("isFree", false)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
              !form.isFree
                ? "bg-electric/15 border-electric/40 text-electric"
                : "bg-carbon border-border/30 text-muted-foreground"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Paid
          </button>
          <button
            onClick={() => set("isFree", true)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
              form.isFree
                ? "bg-electric/15 border-electric/40 text-electric"
                : "bg-carbon border-border/30 text-muted-foreground"
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            Free
          </button>
        </div>
        {!form.isFree && (
          <div className="mt-2 flex items-center gap-2 bg-carbon border border-border/40 rounded-xl px-3 py-2.5">
            <span className="text-muted-foreground text-sm">$</span>
            <input
              type="number"
              min={1}
              max={9999}
              step={1}
              className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
              value={form.price}
              onChange={(e) => set("price", Number(e.target.value))}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-border/40 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim() || !form.title.trim()}
          className="flex-1 py-2.5 rounded-xl bg-electric/15 border border-electric/30 text-xs font-semibold text-electric hover:bg-electric/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save Template
        </button>
      </div>
    </motion.div>
  );
}

interface TemplateCardProps {
  template: SessionTemplate;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function TemplateCard({ template, onEdit, onDuplicate, onDelete }: TemplateCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-obsidian rounded-2xl border border-border/30 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-electric/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-electric" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{template.name}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{template.title}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                template.isFree
                  ? "bg-emerald-400/10 text-emerald-400"
                  : "bg-gold/10 text-gold"
              }`}
            >
              {template.isFree ? "FREE" : `$${template.price}`}
            </span>
            {template.description && (
              <span className="text-[10px] text-muted-foreground/60 truncate">
                {template.description.slice(0, 40)}
                {template.description.length > 40 ? "…" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20">
        <button
          onClick={() => { triggerClickHaptic(); onEdit(); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors border border-border/30"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
        <button
          onClick={() => { triggerClickHaptic(); onDuplicate(); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors border border-border/30"
        >
          <Copy className="w-3 h-3" />
          Duplicate
        </button>
        <button
          onClick={() => { triggerClickHaptic(); onDelete(); }}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 transition-colors border border-border/30"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export function SessionTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.auth.getUser();
    const stored = data?.user?.user_metadata?.session_templates;
    setTemplates(Array.isArray(stored) ? stored : []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const persistTemplates = async (updated: SessionTemplate[]) => {
    await supabase.auth.updateUser({ data: { session_templates: updated } });
  };

  const handleSave = async (form: Omit<SessionTemplate, "id" | "createdAt">) => {
    setSaving(true);
    try {
      let updated: SessionTemplate[];
      if (editingTemplate) {
        updated = templates.map((t) =>
          t.id === editingTemplate.id ? { ...t, ...form } : t
        );
      } else {
        const newTemplate: SessionTemplate = {
          ...form,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        updated = [newTemplate, ...templates];
      }
      await persistTemplates(updated);
      setTemplates(updated);
      setShowForm(false);
      setEditingTemplate(null);
      toast.success(editingTemplate ? "Template updated" : "Template saved");
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (template: SessionTemplate) => {
    triggerClickHaptic();
    const copy: SessionTemplate = {
      ...template,
      id: generateId(),
      name: `${template.name} (copy)`,
      createdAt: new Date().toISOString(),
    };
    const updated = [copy, ...templates];
    await persistTemplates(updated);
    setTemplates(updated);
    toast.success("Template duplicated");
  };

  const handleDelete = async (id: string) => {
    triggerClickHaptic();
    const updated = templates.filter((t) => t.id !== id);
    await persistTemplates(updated);
    setTemplates(updated);
    toast.success("Template deleted");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Session Templates</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Save session setups to reuse when going live
          </p>
        </div>
        {!showForm && !editingTemplate && (
          <button
            onClick={() => { triggerClickHaptic(); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-electric/15 border border-electric/30 text-xs font-semibold text-electric hover:bg-electric/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {(showForm || editingTemplate) && (
          <TemplateForm
            key={editingTemplate?.id ?? "new"}
            initial={editingTemplate}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingTemplate(null); }}
            saving={saving}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {templates.length > 0 ? (
          templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onEdit={() => { setEditingTemplate(tpl); setShowForm(false); }}
              onDuplicate={() => handleDuplicate(tpl)}
              onDelete={() => handleDelete(tpl.id)}
            />
          ))
        ) : !showForm ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-10 bg-obsidian rounded-2xl border border-border/30"
          >
            <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No templates yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1 text-center px-6">
              Create your first template to speed up session setup
            </p>
            <button
              onClick={() => { triggerClickHaptic(); setShowForm(true); }}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-full bg-electric/15 border border-electric/30 text-xs font-semibold text-electric hover:bg-electric/25 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Template
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
