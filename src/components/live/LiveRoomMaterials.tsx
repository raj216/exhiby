import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Palette, Plus, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface Material {
  id: string;
  name: string;
  brand?: string | null;
  spec?: string | null;
}

interface LiveRoomMaterialsProps {
  isOpen: boolean;
  onClose: () => void;
  materials: Material[];
  isHost: boolean;
  onAddMaterial?: (name: string, brand?: string, spec?: string) => void;
  onUpdateMaterial?: (id: string, name: string, brand?: string, spec?: string) => void;
  onDeleteMaterial?: (id: string) => void;
}

export function LiveRoomMaterials({
  isOpen,
  onClose,
  materials,
  isHost,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
}: LiveRoomMaterialsProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formBrand, setFormBrand] = useState("");
  const [formSpec, setFormSpec] = useState("");

  const resetForm = () => {
    setFormName("");
    setFormBrand("");
    setFormSpec("");
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!formName.trim()) return;

    if (editingId) {
      onUpdateMaterial?.(editingId, formName.trim(), formBrand.trim(), formSpec.trim());
    } else {
      onAddMaterial?.(formName.trim(), formBrand.trim(), formSpec.trim());
    }
    resetForm();
  };

  const handleEdit = (material: Material) => {
    setEditingId(material.id);
    setFormName(material.name);
    setFormBrand(material.brand || "");
    setFormSpec(material.spec || "");
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    onDeleteMaterial?.(id);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="absolute right-0 top-0 bottom-0 z-30 w-full max-w-sm flex flex-col"
          style={{
            background: "linear-gradient(to left, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 70%, transparent 100%)",
            paddingTop: "max(80px, env(safe-area-inset-top) + 60px)",
            paddingBottom: "max(100px, env(safe-area-inset-bottom) + 80px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-gold" />
              <h3 className="text-white font-semibold">Materials</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Add Material Form (Host Only) */}
          <AnimatePresence>
            {isHost && showForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 py-3 border-b border-white/10 space-y-2"
              >
                <Input
                  placeholder="Item Name *"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
                <Input
                  placeholder="Brand (optional)"
                  value={formBrand}
                  onChange={(e) => setFormBrand(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
                <Input
                  placeholder="Spec/Grade (e.g. 2B, 300gsm)"
                  value={formSpec}
                  onChange={(e) => setFormSpec(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!formName.trim()}
                    className="flex-1 bg-gold text-background hover:bg-gold/90"
                  >
                    {editingId ? "Update" : "Add"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add Button (Host Only) */}
          {isHost && !showForm && (
            <div className="px-4 py-3 border-b border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(true)}
                className="w-full text-gold hover:text-gold hover:bg-gold/10 gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Material
              </Button>
            </div>
          )}

          {/* Materials List */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {materials.length === 0 ? (
              <p className="text-white/50 text-sm text-center py-8">
                No materials listed yet
              </p>
            ) : (
              materials.map((material) => (
                <motion.div
                  key={material.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="text-white font-medium text-sm">{material.name}</h4>
                      {material.brand && (
                        <p className="text-gold text-xs mt-0.5">{material.brand}</p>
                      )}
                      {material.spec && (
                        <p className="text-white/60 text-xs mt-1">{material.spec}</p>
                      )}
                    </div>
                    {isHost && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(material)}
                          className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                        >
                          <Pencil className="w-3 h-3 text-white" />
                        </button>
                        <button
                          onClick={() => handleDelete(material.id)}
                          className="w-7 h-7 rounded-full bg-destructive/30 flex items-center justify-center hover:bg-destructive/50 transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-3 border-t border-white/10">
            <p className="text-white/40 text-xs text-center">
              {isHost ? "Materials you're using in this session" : "Materials the artist is using"}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
