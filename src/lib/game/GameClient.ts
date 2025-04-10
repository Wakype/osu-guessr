import { startGameAction, submitGuessAction, getGameStateAction, endGameAction, getSuggestionsAction } from "@/actions/game-server";
import { soundManager } from "./sounds";
import { GameSession } from "./types";
import { GameVariant } from "@/app/games/config";
import { GameState } from "@/actions/types";

type GameMode = "background" | "audio";

export class GameClient {
    private session: GameSession | null = null;
    private onStateUpdate: (state: GameState) => void;
    private gameMode: GameMode;
    private gameVariant: GameVariant;
    private userVolume: number = 0.25;

    constructor(onStateUpdate: (state: GameState) => void, gameMode: GameMode = "background", gameVariant: GameVariant = "classic") {
        this.onStateUpdate = onStateUpdate;
        this.gameMode = gameMode;
        this.gameVariant = gameVariant;
    }

    setVolume(volume: number): void {
        this.userVolume = volume;
    }

    getVolume(): number {
        return this.userVolume;
    }

    async startGame(): Promise<void> {
        try {
            const initialState = await startGameAction(this.gameMode, this.gameVariant);

            this.session = {
                id: initialState.sessionId,
                state: initialState,
                timer: null,
                isActive: true,
            };
            this.startTimer();
            console.log(`[Game Client]: Started ${this.gameMode} Game (${this.gameVariant} mode)`);
        } catch (error) {
            console.error("Failed to start game:", error);
            throw error;
        }
    }

    private startTimer(): void {
        if (!this.session?.isActive) return;

        this.stopTimer();

        this.session.timer = setInterval(() => {
            if (!this.session?.state) return;

            const newTimeLeft = Math.max(0, this.session.state.timeLeft - 1);
            this.updateState({ ...this.session.state, timeLeft: newTimeLeft });

            if (newTimeLeft === 0) {
                this.handleTimeout();
            }
        }, 1000);
    }

    private stopTimer(): void {
        if (this.session?.timer) {
            clearInterval(this.session.timer);
            this.session.timer = null;
        }
    }

    private async handleTimeout(): Promise<void> {
        if (!this.session?.isActive || !this.session?.id) return;

        this.stopTimer();
        try {
            soundManager.play("timeout");
            const newState = await submitGuessAction(this.session.id, "");
            this.updateState(newState);
            console.log("[Game Client]: Round timed out");
        } catch (error) {
            console.error("Failed to handle timeout:", error);
            await this.recoverState();
        }
    }

    async submitGuess(guess: string): Promise<void> {
        if (!this.session?.isActive) return;

        this.stopTimer();

        try {
            const newState = await submitGuessAction(this.session.id, guess);

            if (newState.lastGuess?.correct) {
                soundManager.play("correct");
            } else {
                soundManager.play("wrong");
            }

            this.updateState(newState);
            console.log("[Game Client]: Submitted Guess");
        } catch (error) {
            console.error("Failed to submit guess:", error);
            await this.recoverState();
        }
    }

    async skipAnswer(): Promise<void> {
        if (!this.session?.isActive) return;
        this.stopTimer();

        try {
            soundManager.play("skip");
            const newState = await submitGuessAction(this.session.id, null);
            this.updateState(newState);
            console.log("[Game Client]: Revealed Answer");
        } catch (error) {
            console.error("Failed to reveal answer:", error);
            await this.recoverState();
        }
    }

    async goNextRound(): Promise<void> {
        if (!this.session?.isActive) return;

        try {
            const newState = await submitGuessAction(this.session.id, undefined);
            this.updateState(newState);
            this.startTimer();
            console.log("[Game Client]: Next Round");
        } catch (error) {
            console.error("Failed to go to next round:", error);
            await this.recoverState();
        }
    }

    private async recoverState(): Promise<void> {
        try {
            if (!this.session?.id) return;
            const currentState = await getGameStateAction(this.session.id);
            this.updateState(currentState);
        } catch (error) {
            console.error("Failed to recover state:", error);
        }
    }

    private updateState(newState: GameState): void {
        if (!this.session) return;
        this.session.state = newState;
        this.onStateUpdate(newState);
    }

    async endGame(): Promise<void> {
        if (!this.session?.id) return;

        this.stopTimer();
        this.session.isActive = false;

        try {
            await endGameAction(this.session.id);
            console.log("[Game Client]: Ended Game");
        } catch (error) {
            console.error("Failed to end game:", error);
            throw error;
        } finally {
            this.cleanup();
        }
    }

    async getSuggestions(query: string): Promise<string[]> {
        if (!this.session?.isActive || this.session.state.currentBeatmap.revealed) {
            return [];
        }

        try {
            const suggestions = await getSuggestionsAction(query);
            return suggestions;
        } catch (error) {
            console.error("Failed to get suggestions:", error);
            return [];
        }
    }

    private cleanup(): void {
        this.stopTimer();
        this.session = null;
    }
}
