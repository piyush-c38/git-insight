export type RepoFile = {
  path: string;
  name: string;
  type: 'file' | 'folder';
  important?: boolean;
  children?: RepoFile[];
};

export const buildTree = (paths: string[]): RepoFile => {
  const root: RepoFile = { path: '', name: '', type: 'folder', children: [] };

  paths.forEach((fullPath) => {
    const parts = fullPath.split('/').filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const nextPath = current.path ? `${current.path}/${part}` : part;
      let child = current.children?.find((node) => node.name === part);

      if (!child) {
        child = {
          path: nextPath,
          name: part,
          type: isFile ? 'file' : 'folder',
          important: /readme|package\.json|tsconfig|tailwind|vite|next\.config|app\//i.test(nextPath),
          children: isFile ? undefined : [],
        };
        current.children?.push(child);
      }

      current = child;
    });
  });

  return root;
};

/** Backend already stores repo-relative paths; do not strip shared prefixes. */
export const normalizeFilePaths = (paths: string[]) => {
  return paths
    .map((pathValue) => pathValue.replace(/\\/g, '/').replace(/^\//, ''))
    .filter(Boolean);
};