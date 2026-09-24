import { useEffect, useState } from "react";

import {
  createArea as createAreaRequest,
  deleteArea as deleteAreaRequest,
  listAreas,
  renameArea as renameAreaRequest,
  setAreaArchived,
  type Area,
} from "../api/areasApi";

function areaErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const value = error as {
    code?: unknown;
    message?: unknown;
    fields?: Record<string, unknown>;
  };
  if (value.code === "area_name_taken") {
    return "You already have an area with this name.";
  }
  if (
    value.code === "validation_error" &&
    typeof value.fields?.name === "string"
  ) {
    return value.fields.name;
  }
  return typeof value.message === "string" ? value.message : fallback;
}

export function useAreas() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedArea = areas.find((area) => area.id === selectedAreaId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadAreas() {
      try {
        const { data, error } = await listAreas();
        if (cancelled) {
          return;
        }
        if (!data) {
          setLoadError(areaErrorMessage(error, "We couldn't load your areas."));
          return;
        }
        setAreas(data.areas);
        setSelectedAreaId((current) =>
          current && data.areas.some((area) => area.id === current)
            ? current
            : (data.areas.find((area) => area.archived_at === null)?.id ??
              data.areas[0]?.id ??
              null),
        );
      } catch {
        if (!cancelled) {
          setLoadError("We couldn't reach Spoons Up. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAreas();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectArea = (areaId: string) => {
    setSelectedAreaId(areaId);
    setIsRenaming(false);
    setActionError(null);
    setIsConfirmingDelete(false);
  };

  const startAdding = () => {
    setCreateError(null);
    setIsAdding(true);
  };

  const cancelAdding = () => {
    setCreateError(null);
    setNewAreaName("");
    setIsAdding(false);
  };

  const createArea = async () => {
    setIsSaving(true);
    setCreateError(null);
    try {
      const { data, error } = await createAreaRequest(newAreaName.trim());
      if (!data) {
        setCreateError(areaErrorMessage(error, "We couldn't create this area."));
        return false;
      }
      setAreas((current) => [...current, data]);
      setSelectedAreaId(data.id);
      setNewAreaName("");
      setIsAdding(false);
      return true;
    } catch {
      setCreateError("We couldn't reach Spoons Up. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const startRenaming = () => {
    if (!selectedArea || selectedArea.archived_at !== null) {
      return;
    }
    setRenameName(selectedArea.name);
    setRenameError(null);
    setActionError(null);
    setIsRenaming(true);
  };

  const cancelRenaming = () => {
    setIsRenaming(false);
    setRenameError(null);
  };

  const renameArea = async () => {
    if (!selectedArea) {
      return;
    }
    setIsSaving(true);
    setRenameError(null);
    try {
      const { data, error } = await renameAreaRequest(
        selectedArea.id,
        renameName.trim(),
      );
      if (!data) {
        setRenameError(areaErrorMessage(error, "We couldn't rename this area."));
        return;
      }
      setAreas((current) =>
        current.map((area) => (area.id === data.id ? data : area)),
      );
      setIsRenaming(false);
    } catch {
      setRenameError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const changeArchiveState = async (archived: boolean): Promise<boolean> => {
    if (!selectedArea) {
      return false;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      const { data, error } = await setAreaArchived(selectedArea.id, archived);
      if (!data) {
        setActionError(
          areaErrorMessage(
            error,
            archived
              ? "We couldn't archive this area."
              : "We couldn't restore this area.",
          ),
        );
        return false;
      }
      setAreas((current) =>
        current.map((area) => (area.id === data.id ? data : area)),
      );
      setIsRenaming(false);
      setIsConfirmingDelete(false);
      return true;
    } catch {
      setActionError("We couldn't reach Spoons Up. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteArea = async () => {
    if (!selectedArea || selectedArea.archived_at === null) {
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      const { error, response } = await deleteAreaRequest(selectedArea.id);
      if (response.status !== 204) {
        setActionError(areaErrorMessage(error, "We couldn't delete this area."));
        return;
      }
      const remainingAreas = areas.filter((area) => area.id !== selectedArea.id);
      setAreas(remainingAreas);
      setSelectedAreaId(
        remainingAreas.find((area) => area.archived_at !== null)?.id ?? null,
      );
      setIsConfirmingDelete(false);
    } catch {
      setActionError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    areas,
    selectedArea,
    selectedAreaId,
    isLoading,
    loadError,
    isAdding,
    isSaving,
    newAreaName,
    createError,
    isRenaming,
    renameName,
    renameError,
    actionError,
    isConfirmingDelete,
    selectArea,
    startAdding,
    cancelAdding,
    setNewAreaName,
    createArea,
    startRenaming,
    cancelRenaming,
    setRenameName,
    renameArea,
    archiveArea: () => changeArchiveState(true),
    restoreArea: () => changeArchiveState(false),
    startDeleting: () => {
      setActionError(null);
      setIsConfirmingDelete(true);
    },
    cancelDeleting: () => setIsConfirmingDelete(false),
    deleteArea,
  };
}
