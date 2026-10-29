import { channelMention } from 'discord.js';

export const partnerMessages = {
  alreadyInterested: 'Веќе си додаден/а во разговорот за овој оглас.',
  listingClosed: 'Огласот е затворен.',
  threadWelcome:
    'Користете ја оваа нишка за да се запознаете, да ги договорите очекувањата и да го формирате тимот. Не споделувајте приватни контакт-податоци јавно.',
};

export const partnerMessageFunctions = {
  interested: (threadId: string) =>
    `Додаден/а си во разговорот: ${channelMention(threadId)}`,
  listingCreated: (threadId: string) =>
    `Огласот е креиран: ${channelMention(threadId)}`,
};

export const partnerErrors = {
  activeListingExists: 'Веќе имаш активен оглас за овој предмет во овој канал.',
  cannotJoinOwnListing: 'Не можеш да се пријавиш на сопствениот оглас.',
  courseNotFound: 'Предметот не постои или податоците не се достапни.',
  invalidChannel:
    'Командата може да се користи само во текстуален канал во категорија за предмет.',
  invalidListing: 'Огласот не е валиден или повеќе не е активен.',
  invalidOptions: 'Провери ги предметот, бројот на членови и описот.',
  listingCreationFailed:
    'Огласот не можеше да се креира. Провери ги дозволите на ботот и обиди се повторно.',
  listingNoPermission:
    'Само авторот на огласот или модератор може да го затвори.',
};
