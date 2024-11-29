
export function getMessage(port: number | string): string {
    const messages = [
        `The well is open at depth ${port}. Tread carefully.`,
        `Nemi whispers: The portal hums at ${port}.`,
        `Nemi says: I'm listening... but are you worthy? (${port})`,
        `The code flows at ${port}. Beware the ripple.`,
        `Server active at ${port}. Sacrifices to the code gods accepted.`,
        `Echoes at ${port}: The well awakens.`,
        `The quest begins at port ${port}. Bring snacks.`
    ];

    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
}