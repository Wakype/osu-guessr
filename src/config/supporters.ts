export interface Supporter {
    name: string;
    url?: string;
    amount: number;
    message?: string;
}

export const supporters: Array<Supporter> = [
    { name: "neriv", url: "https://guesser.yorunoken.com/user/12643934", amount: 5, message: "enjoy ur coffee bro" },
    {
        name: "neriv",
        url: "https://guesser.yorunoken.com/user/4573558",
        amount: 5,
        message: `yoru — Yesterday at 5:41 am
    osu!guessr`,
    },
];
