"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { db, ProjectDescription } from "@/db/dexie";

export default function ProjectDescriptionsPage() {
  const [descriptions, setDescriptions] = useState<ProjectDescription[]>([]);
  const [language, setLanguage] = useState("");
  const [frameworks, setFrameworks] = useState("");
  const [metadata, setMetadata] = useState("");

  // Load existing project descriptions
  useEffect(() => {
    (async () => {
      const data = await db.projectDescriptions.toArray();
      setDescriptions(data);
    })();
  }, []);

  // Add a new ProjectDescription
  async function handleAdd() {
    if (!language.trim()) return;

    await db.projectDescriptions.add({
      language,
      frameworks,
      metadata,
    });

    const all = await db.projectDescriptions.toArray();
    setDescriptions(all);

    // Clear inputs
    setLanguage("");
    setFrameworks("");
    setMetadata("");
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Project Descriptions</h1>

      <div className="border rounded p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Add New Description</h2>
        <div className="mb-2">
          <Input
            placeholder="Language (e.g. TypeScript)"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
        </div>
        <div className="mb-2">
          <Input
            placeholder="Frameworks (comma-separated)"
            value={frameworks}
            onChange={(e) => setFrameworks(e.target.value)}
          />
        </div>
        <div className="mb-2">
          <Textarea
            placeholder="Metadata (optional JSON or text)"
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
          />
        </div>
        <Button onClick={handleAdd}>Add Description</Button>
      </div>

      {descriptions.length === 0 ? (
        <p>No project descriptions yet.</p>
      ) : (
        descriptions.map((desc) => (
          <div key={desc.id} className="border rounded p-4 mb-2">
            <p>
              <strong>Language:</strong> {desc.language}
            </p>
            <p>
              <strong>Frameworks:</strong> {desc.frameworks}
            </p>
            <p>
              <strong>Metadata:</strong> {desc.metadata}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
