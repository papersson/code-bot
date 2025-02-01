"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, Project } from "@/db/dexie";

export default function ProjectsPage() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);

  // For creating a new project:
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Guard: if not signed in, show a warning
  if (!session?.user?.email) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-red-600">Please sign in to view or create projects.</p>
      </div>
    );
  }

  // Load projects on mount
  useEffect(() => {
    (async () => {
      const allProjects = await db.projects.toArray();
      setProjects(allProjects);
    })();
  }, []);

  async function handleCreateProject() {
    if (!newName.trim()) return;

    // Insert into local DB
    await db.projects.add({
      name: newName,
      description: newDesc || null,
      createdAt: new Date(),
    });

    // Refresh the list
    const refreshed = await db.projects.toArray();
    setProjects(refreshed);

    setNewName("");
    setNewDesc("");
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Projects</h1>

      {/* Create a new project */}
      <div className="border rounded p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Create New Project</h2>
        <div className="mb-2">
          <Input
            placeholder="Project name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="mb-2">
          <Input
            placeholder="Project description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
        </div>
        <Button onClick={handleCreateProject}>Create</Button>
      </div>

      {projects.length === 0 ? (
        <p>No projects yet.</p>
      ) : (
        projects.map((proj) => (
          <div key={proj.id} className="border rounded p-4 mb-2">
            <h2 className="text-xl font-semibold">{proj.name}</h2>
            <p>{proj.description}</p>
            <p className="text-xs text-gray-500">
              {proj.createdAt
                ? `Created: ${new Date(proj.createdAt).toLocaleString()}`
                : ""}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
