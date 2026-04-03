import { Plus, Trash2, GripVertical, Link2 } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";

export type InlineButton = { text: string; url: string };
export type InlineButtonRow = InlineButton[];
export type InlineButtonGrid = InlineButtonRow[];

interface InlineButtonBuilderProps {
  value: InlineButtonGrid;
  onChange: (value: InlineButtonGrid) => void;
}

export function InlineButtonBuilder({ value, onChange }: InlineButtonBuilderProps) {
  const addRow = () => {
    onChange([...value, [{ text: "", url: "" }]]);
  };

  const addButtonToRow = (rowIndex: number) => {
    const updated = value.map((row, i) =>
      i === rowIndex ? [...row, { text: "", url: "" }] : row
    );
    onChange(updated);
  };

  const removeRow = (rowIndex: number) => {
    onChange(value.filter((_, i) => i !== rowIndex));
  };

  const removeButton = (rowIndex: number, btnIndex: number) => {
    const updated = value
      .map((row, i) =>
        i === rowIndex ? row.filter((_, j) => j !== btnIndex) : row
      )
      .filter((row) => row.length > 0);
    onChange(updated);
  };

  const updateButton = (
    rowIndex: number,
    btnIndex: number,
    field: "text" | "url",
    val: string
  ) => {
    const updated = value.map((row, i) =>
      i === rowIndex
        ? row.map((btn, j) => (j === btnIndex ? { ...btn, [field]: val } : btn))
        : row
    );
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Inline Buttons</Label>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="w-3 h-3 mr-1" />
          Add Row
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="border border-dashed border-border/60 rounded-lg p-4 text-center text-sm text-muted-foreground">
          No buttons yet. Click "Add Row" to create a row of buttons.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((row, rowIndex) => (
            <div key={rowIndex} className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GripVertical className="w-3 h-3" />
                  Row {rowIndex + 1}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-primary"
                    onClick={() => addButtonToRow(rowIndex)}
                    disabled={row.length >= 3}
                  >
                    <Plus className="w-3 h-3 mr-0.5" />
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-red-400"
                    onClick={() => removeRow(rowIndex)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className={`grid gap-2 ${row.length === 1 ? "grid-cols-1" : row.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {row.map((btn, btnIndex) => (
                  <div key={btnIndex} className="space-y-1.5 relative group">
                    <Input
                      placeholder="Button text"
                      value={btn.text}
                      onChange={(e) => updateButton(rowIndex, btnIndex, "text", e.target.value)}
                      className="text-sm h-8"
                    />
                    <div className="relative">
                      <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input
                        placeholder="https://..."
                        value={btn.url}
                        onChange={(e) => updateButton(rowIndex, btnIndex, "url", e.target.value)}
                        className="text-sm h-8 pl-6"
                      />
                    </div>
                    {row.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute -top-1 -right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 bg-card border border-border rounded-full"
                        onClick={() => removeButton(rowIndex, btnIndex)}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <div className="rounded-md bg-muted/30 border border-border/40 p-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Preview</p>
          <div className="space-y-1">
            {value.map((row, i) => (
              <div key={i} className="flex gap-1">
                {row.map((btn, j) => (
                  <div
                    key={j}
                    className="flex-1 text-center text-xs bg-primary/10 text-primary border border-primary/20 rounded px-2 py-1 truncate"
                  >
                    {btn.text || <span className="text-muted-foreground">Button text</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
