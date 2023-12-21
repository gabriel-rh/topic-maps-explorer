// src/topicMapsExplorer.ts
import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

interface TopicMap {
  Name: string;
  Dir?: string;
  Distros?: string[];
  Topics?: TopicMap[];
  File?: string;
}

class CustomTreeItem extends vscode.TreeItem {
  children: CustomTreeItem[] | undefined;

  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState);
    this.children = undefined;
  }
}

export class TopicMapsExplorer
  implements vscode.TreeDataProvider<CustomTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    CustomTreeItem | undefined
  > = new vscode.EventEmitter<CustomTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<
    CustomTreeItem | undefined
  > = this._onDidChangeTreeData.event;

  private uriToTreeItemMap: Map<string, CustomTreeItem> = new Map();

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  private isDirNode(treeItem: CustomTreeItem): boolean {
    return treeItem.children !== undefined;
  }

  private getAllItems(): CustomTreeItem[] {
    const result: CustomTreeItem[] = [];

    const recursivePush = (item: CustomTreeItem) => {

      console.log(item.label)
      result.push(item);
      if (item.children) {
        item.children.forEach(recursivePush);
      }
    };

    this._onDidChangeTreeData.event(() => {
      this.getAllItems().forEach(item => {
        if (this.isDirNode(item)) {
          item.resourceUri = vscode.Uri.parse('invalid:');
        }
      });

      return undefined;
    });

    return result;
  }

  getTreeItem(element: CustomTreeItem): vscode.TreeItem {
    console.log("el: " + element.label)
    return element;
  }

  getChildren(
    element?: CustomTreeItem
  ): Thenable<CustomTreeItem[]> | CustomTreeItem[] {
    if (!element) {
      console.log("getChildren: root")
      // Top-level nodes (topic map files)
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const topicMapsDirectory = workspaceFolders
        ? vscode.Uri.joinPath(workspaceFolders[0].uri, '_topic_maps')
        : undefined;

      if (topicMapsDirectory) {
        return vscode.workspace.fs
          .readDirectory(topicMapsDirectory)
          .then(entries =>
            entries
              .filter(
                ([name, type]) =>
                  type === vscode.FileType.File &&
                  name.startsWith('_topic_map') &&
                  name.endsWith('.yml')
              )
              .map(([fileName]) => {
                const treeItem = new CustomTreeItem(
                  fileName,
                  vscode.TreeItemCollapsibleState.Collapsed
                );

                // Customize properties here
                treeItem.command = undefined;
                treeItem.resourceUri = vscode.Uri.parse('invalid:');

                return treeItem;
              })
          );
      }
    } 
    else if (element.children)
    {
      console.log("getChildren: " + element.label )      
      return element.children;
    }
    else if (element && element.resourceUri && element.resourceUri.toString() != 'invalid:') {
      // Logic to dynamically add children nodes for the given resourceUri
      // ...
  
      console.log("openFile:" + element.resourceUri)

      vscode.workspace.fs.readFile(element.resourceUri).then(buffer => {
        const fileContent = buffer.toString();
        const includes = this.findIncludes(fileContent);
  
        // Create new children nodes based on includes
        const includeNodes = includes.map(include => {
          // Create CustomTreeItem instances based on include paths
          const modItem =  new CustomTreeItem(include, vscode.TreeItemCollapsibleState.None);


          const workspaceFolders = vscode.workspace.workspaceFolders;
          const modulesDirectory = workspaceFolders
            ? vscode.Uri.joinPath(workspaceFolders[0].uri, 'modules')
            : undefined;  

          if (modulesDirectory)
          {
            modItem.resourceUri = vscode.Uri.joinPath(modulesDirectory, include);  
            modItem.command = {
              command: 'vscode.open',
              title: 'Open File',
              arguments: [modItem.resourceUri]          
          }


          
          return modItem;
        });
  
        const clickedNode = element?.resourceUri ? this.getTreeItemByUri(element.resourceUri) : undefined;

        if (clickedNode) {
          clickedNode.children = includeNodes;
          this._onDidChangeTreeData.fire(clickedNode);
        }

        return includeNodes; // Return the new nodes you want to add

      });

    }    
    else {
      console.log("getChildren: " + element.label )
      // Child nodes (topics within a topic map)
      const topicMapFile =
        typeof element.label === 'string' ? element.label : undefined;

      if (topicMapFile) {
        const topicMapsDirectory = vscode.Uri.joinPath(
          vscode.workspace.workspaceFolders![0].uri,
          '_topic_maps',
          topicMapFile
        );

        return vscode.workspace.fs
          .readFile(topicMapsDirectory)
          .then(buffer => buffer.toString())
          .then(content => {
            try {
              // Use (yaml as any).loadAll to handle multiple documents
              const documents = (yaml as any).loadAll(content);

              if (documents) {
                const topics: TopicMap[] = Array.from(
                  documents as IterableIterator<TopicMap>
                );

                if (topics && Array.isArray(topics)) {
                  return topics.map(topic =>
                    this.createCustomTreeItem(topic)
                  );
                }
              }

              return [];
            } catch (error) {
              console.error('Error parsing topic map file:', error);
              return [];
            }
          });
      }
    }

    return [];
  }


  // Command handler for opening a file
  public openFile(resourceUri: vscode.Uri): void {

    console.log("openFile:" + resourceUri)

    vscode.workspace.fs.readFile(resourceUri).then(buffer => {
      const fileContent = buffer.toString();
      const includes = this.findIncludes(fileContent);

      // Create new children nodes based on includes
      const includeNodes = includes.map(include => {
        // Create CustomTreeItem instances based on include paths
        return new CustomTreeItem(include, vscode.TreeItemCollapsibleState.None);
      });

      const clickedNode = this.getTreeItemByUri(resourceUri);
      if (clickedNode) {
        clickedNode.children = includeNodes;
        this._onDidChangeTreeData.fire(clickedNode);
      }
    });
  }

    // Function to find include statements in a file content
    private findIncludes(fileContent: string): string[] {
      // Implement your logic to parse includes from fileContent
      // For example, you can use regular expressions or other parsing techniques
      // and return an array of include paths.
      //const regex = /include::modules\/([^[\]]+)\[\]/g;
      const regex = /include::modules\/([^[\].]+)\.adoc/g;
      const matches = fileContent.match(regex);
      return matches ? matches.map(match => match.replace(/include::modules\//, '')) : [];
    }
  


  private createCustomTreeItem(
    topic: TopicMap,
    parentDir: string = ''
  ): CustomTreeItem {
    const treeItem = topic.Dir
      ? new CustomTreeItem(
          topic.Dir,
          vscode.TreeItemCollapsibleState.Collapsed
        )
      : new CustomTreeItem(
          topic.File  + ".adoc",
          vscode.TreeItemCollapsibleState.Collapsed
        );

    const workspaceFolder = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0]
      : undefined;

    if (workspaceFolder) {
      if (topic.Dir) {

        const newParentDir = parentDir
        ? parentDir + "/" + topic.Dir
        : topic.Dir;

        treeItem.command = undefined; // Set command to undefined for directory nodes
        treeItem.resourceUri = vscode.Uri.parse('invalid:');

        if (topic.Topics && Array.isArray(topic.Topics)) {
          treeItem.children = topic.Topics.map(childTopic =>
            this.createCustomTreeItem(childTopic, newParentDir)
          );
        }

      } else {
        const topicFolderPath = parentDir
          ? vscode.Uri.joinPath(workspaceFolder.uri, parentDir)
          : vscode.Uri.joinPath(workspaceFolder.uri);

        treeItem.resourceUri = topic.File
          ? vscode.Uri.joinPath(topicFolderPath, `${topic.File}.adoc`)
          : vscode.Uri.parse(''); // Set to an empty Uri if topic.File is undefined

        treeItem.command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [treeItem.resourceUri]
      };
                  

      }


    } else {
      treeItem.resourceUri = vscode.Uri.parse(''); // Set to an empty Uri if workspaceFolder is undefined
    }


        // Store the tree item in the mapping
    this.uriToTreeItemMap.set(treeItem.resourceUri.toString(), treeItem);

    return treeItem;
  }

    // Function to get a tree item based on its URI
    public getTreeItemByUri(uri: vscode.Uri): CustomTreeItem | undefined {
      return this.uriToTreeItemMap.get(uri.toString());
    }
}
