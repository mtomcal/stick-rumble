import Phaser from 'phaser';

interface Node {
    x: number; y: number;
    f: number; g: number; h: number;
    parent: Node | null;
}

export class Pathfinder {
    private navGrid: boolean[][] = [];
    private tileSize: number = 50;
    private gridWidth: number = 0;
    private gridHeight: number = 0;
    private width: number = 1600;
    private height: number = 1600;

    constructor(tileSize: number = 50, width: number = 1600, height: number = 1600) {
        this.tileSize = tileSize;
        this.width = width;
        this.height = height;
        this.gridWidth = Math.ceil(width / tileSize);
        this.gridHeight = Math.ceil(height / tileSize);
    }

    public buildNavGrid(walls: Phaser.GameObjects.GameObject[]) {
        this.navGrid = [];
        for (let y = 0; y < this.gridHeight; y++) {
            this.navGrid[y] = [];
            for (let x = 0; x < this.gridWidth; x++) {
                this.navGrid[y][x] = true;
                const cellRect = new Phaser.Geom.Rectangle(
                    x * this.tileSize, 
                    y * this.tileSize, 
                    this.tileSize, 
                    this.tileSize
                );
                for (const wall of walls) {
                    const wallRect = (wall as Phaser.GameObjects.Rectangle).getBounds();
                    if (Phaser.Geom.Intersects.RectangleToRectangle(cellRect, wallRect)) {
                        this.navGrid[y][x] = false;
                        break;
                    }
                }
            }
        }
    }

    public isValidTile(x: number, y: number): boolean {
        if (y >= 0 && y < this.gridHeight && x >= 0 && x < this.gridWidth) {
            return this.navGrid[y][x];
        }
        return false;
    }

    public findPath(start: Phaser.Math.Vector2, target: Phaser.Math.Vector2): {x: number, y: number}[] {
        try {
          let startX = Math.floor(start.x / this.tileSize);
          let startY = Math.floor(start.y / this.tileSize);
          let endX = Math.floor(target.x / this.tileSize);
          let endY = Math.floor(target.y / this.tileSize);
    
          if (startX < 0 || startX >= this.gridWidth || startY < 0 || startY >= this.gridHeight) return [];
          
          endX = Phaser.Math.Clamp(endX, 0, this.gridWidth - 1);
          endY = Phaser.Math.Clamp(endY, 0, this.gridHeight - 1);
    
          // FIX: If target is in a wall (player hugging wall), find nearest open cell
          if (!this.navGrid[endY][endX]) {
              let bestDist = Infinity;
              let bestNode = null;
    
              // Search radius 2
              for (let y = -2; y <= 2; y++) {
                  for (let x = -2; x <= 2; x++) {
                      const nx = endX + x;
                      const ny = endY + y;
                      if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight && this.navGrid[ny][nx]) {
                          const dist = Math.abs(x) + Math.abs(y);
                          if (dist < bestDist) {
                              bestDist = dist;
                              bestNode = {x: nx, y: ny};
                          }
                      }
                  }
              }
    
              if (bestNode) {
                  endX = bestNode.x;
                  endY = bestNode.y;
              } else {
                  return []; // No valid path found
              }
          }
    
          const openSet: Node[] = [];
          const closedSet: Set<string> = new Set();
    
          openSet.push({ x: startX, y: startY, f: 0, g: 0, h: 0, parent: null });
    
          let steps = 0;
          const MAX_PATH_STEPS = 500; 
    
          while (openSet.length > 0) {
              steps++;
              if (steps > MAX_PATH_STEPS) return []; 
    
              let lowInd = 0;
              for(let i=0; i<openSet.length; i++) {
                  if(openSet[i].f < openSet[lowInd].f) lowInd = i;
              }
              const currentNode = openSet[lowInd];
    
              if (currentNode.x === endX && currentNode.y === endY) {
                  const path = [];
                  let curr: Node | null = currentNode;
                  while (curr) {
                      path.push({ 
                          x: curr.x * this.tileSize + this.tileSize/2, 
                          y: curr.y * this.tileSize + this.tileSize/2 
                      });
                      curr = curr.parent;
                  }
                  return path.reverse();
              }
    
              openSet.splice(lowInd, 1);
              closedSet.add(`${currentNode.x},${currentNode.y}`);
    
              const neighbors = [
                  {x: 0, y: -1}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 1, y: 0}
              ];
    
              for (const offset of neighbors) {
                  const nx = currentNode.x + offset.x;
                  const ny = currentNode.y + offset.y;
    
                  if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight) continue;
                  if (!this.navGrid[ny][nx]) continue;
                  if (closedSet.has(`${nx},${ny}`)) continue;
    
                  const gScore = currentNode.g + 1;
                  let gScoreIsBest = false;
                  let neighborNode = openSet.find(n => n.x === nx && n.y === ny);
    
                  if (!neighborNode) {
                      gScoreIsBest = true;
                      neighborNode = { 
                          x: nx, y: ny, 
                          f: 0, g: gScore, 
                          h: Math.abs(nx - endX) + Math.abs(ny - endY),
                          parent: currentNode 
                      };
                      openSet.push(neighborNode);
                  } else if (gScore < neighborNode.g) {
                      gScoreIsBest = true;
                  }
    
                  if (gScoreIsBest && neighborNode) {
                      neighborNode.parent = currentNode;
                      neighborNode.g = gScore;
                      neighborNode.f = neighborNode.g + neighborNode.h;
                  }
              }
          }
          return [];
        } catch (err) {
          console.error("Pathfinding error", err);
          return [];
        }
    }
}