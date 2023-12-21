// src/extension.ts
import * as vscode from 'vscode';
import { TopicMapsExplorer } from './topicMapsExplorer';

let currentExplorer: TopicMapsExplorer | undefined;

export function activate(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (workspaceFolders) {
    (async () => {
      for (const workspaceFolder of workspaceFolders) {
        const topicMapsDirectory = vscode.Uri.joinPath(
          workspaceFolder.uri,
          '_topic_maps'
        );

        try {
          const stat = await vscode.workspace.fs.stat(topicMapsDirectory);

          if (stat.type === vscode.FileType.Directory) {
            const explorer = new TopicMapsExplorer(context);
            currentExplorer = explorer;

            vscode.window.createTreeView('topicMapsExplorer', {
              treeDataProvider: explorer,
              showCollapseAll: true,
            });

            vscode.commands.registerCommand(
              'topicMapsExplorer.refresh',
              () => explorer.refresh()
            );

            return;
          }
        } catch (error) {
          // Ignore errors and continue searching for the directory
        }
      }

      vscode.window.showInformationMessage(
        'No "_topic_maps" directory found at the first level inside the workspace. Please create the directory and place your topic map files in it.'
      );
    })();
  }
}

export function getCurrentExplorer() {
  return currentExplorer;
}

export function deactivate() {}
