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

export const normalizeFilePaths = (paths: string[]) => {
  if (paths.length === 0) return [];

  const prefix = paths.reduce((acc: string, current: string) => {
    if (!acc) return current;
    let index = 0;
    while (index < acc.length && index < current.length && acc[index] === current[index]) index += 1;
    return acc.slice(0, index);
  }, '');

  return paths.map((pathValue: string) => pathValue.replace(prefix, '').replace(/^\//, ''));
};