/**
 * Voz de cada facción para la crónica del ejército. Los textos son propios (inspirados en el tono del mundo de
 * Warhammer); lo que se narra sale de las tarjetas: quién manda, qué tropas hay, qué rasgos tienen y qué les falta.
 */
export interface LoreVoice {
  /** Cómo se llama a la hueste */
  host: string[];
  /** Apertura antes de nombrar al señor ({lord}) */
  open: string[];
  /** Grito o lema de cierre */
  cry: string[];
  /** Sustantivos por tipo de tropa */
  troops: Partial<Record<'inf' | 'missile' | 'cav' | 'monster' | 'art', string>>;
  /** Frase cuando el ejército tiene magia, miedo, armadura o vuelo */
  magic?: string; fear?: string; armour?: string; fly?: string;
  /** Cuando le falta algo: el temor de la facción */
  dread?: string;
}

const V: Record<string, LoreVoice> = {
  wh_main_sc_emp_empire: {
    host: ['las huestes del Emperador', 'un ejército del Imperio', 'los regimientos estatales'],
    open: ['Bajo el martillo de Sigmar y los estandartes de las provincias marcha', 'Al redoble de los tambores de Altdorf avanza'],
    cry: ['¡Por Sigmar y por el Emperador!', '¡Ni un paso atrás, hijos del Imperio!'],
    troops: { inf: 'regimientos de soldados estatales', missile: 'tiradores y ballesteros', cav: 'caballeros de las órdenes', monster: 'bestias domadas', art: 'cañones de la Escuela de Artillería' },
    magic: 'Los magos de los Colegios tejen los Vientos a su favor.', fear: 'Hasta el enemigo más curtido siente miedo ante ellos.',
    armour: 'El acero de Nuln brilla en sus corazas.', dread: 'Pero ningún general sensato olvidaría que',
  },
  wh_main_sc_dwf_dwarfs: {
    host: ['un clan en armas', 'una hueste de los Karaks', 'los barbalargas y sus hermanos'],
    open: ['Desde las fortalezas de las montañas, con el Libro de los Agravios abierto, desciende', 'Con paso firme y la barba trenzada marcha'],
    cry: ['¡Khazukan Kazakit-ha!', '¡Ningún agravio quedará sin saldar!'],
    troops: { inf: 'guerreros de piedra y acero', missile: 'atronadores y ballesteros', cav: 'girocópteros y carros', monster: 'bestias de las profundidades', art: 'máquinas de los ingenieros' },
    magic: 'Las runas grabadas por los Herreros Rúnicos arden con poder ancestral.', armour: 'Su armadura de gromril resiste lo que derribaría a cualquier otro pueblo.',
    fear: 'Su sola presencia hace temblar a pieles verdes y skavens.', dread: 'Aunque los ancestros lo saben bien:',
  },
  wh_main_sc_brt_bretonnia: {
    host: ['la caballería de Bretonia', 'una hueste de la Dama', 'los caballeros del rey'],
    open: ['Con la bendición de la Dama del Lago cabalga', 'Bajo pendones de oro y azul avanza'],
    cry: ['¡Por la Dama y por el honor!', '¡Que tiemble el enemigo ante la carga!'],
    troops: { inf: 'campesinos leales', missile: 'arqueros campesinos', cav: 'caballeros juramentados', monster: 'monturas nobles', art: 'trebuchets de asedio' },
    magic: 'Las damiselas de la Dama invocan su gracia sobre el campo.', armour: 'Sus caballeros visten la mejor armadura del reino.',
    fear: 'Su carga ha hecho huir a ejércitos enteros.', dread: 'Mas el honor no ciega a un buen señor:',
  },
  wh_main_sc_vmp_vampire_counts: {
    host: ['una legión de No Muertos', 'la hueste de los Condes Vampiro', 'un ejército alzado de las tumbas'],
    open: ['Entre la niebla de Sylvania y el olor a tierra removida se alza', 'Bajo una luna enferma, al llamado de la sangre, despierta'],
    cry: ['¡Levantaos, siervos, y servid a vuestro amo!', 'La muerte no es el final… es el reclutamiento.'],
    troops: { inf: 'muertos que no conocen el miedo', missile: 'sombras que acechan', cav: 'jinetes de la noche', monster: 'horrores alados y bestias de cripta', art: 'carros de la muerte' },
    magic: 'Los Vientos de la Muerte obedecen a su señor y alzan a los caídos.', fear: 'Los vivos huyen al verlos llegar.',
    fly: 'Murciélagos y espectros cubren el cielo.', dread: 'Y sin embargo, hasta un inmortal debe recordar que',
  },
  wh2_dlc11_sc_cst_vampire_coast: {
    host: ['una flota de muertos', 'la tripulación de la Costa del Vampiro', 'una horda pirata maldita'],
    open: ['Desde las profundidades del Gran Océano emerge', 'Entre cañonazos y canciones de taberna desembarca'],
    cry: ['¡Al abordaje, perros sarnosos!', '¡Que la marea se lleve sus huesos!'],
    troops: { inf: 'marineros podridos', missile: 'tiradores con pólvora y plomo', cav: 'bestias marinas', monster: 'horrores del fondo del mar', art: 'cañones que nunca se mojan' },
    magic: 'La magia de las mareas negras los acompaña.', fear: 'Hasta los mares más fieros temen su bandera.', dread: 'Pero hasta el capitán más loco sabe que',
  },
  wh2_main_sc_hef_high_elves: {
    host: ['las huestes de Ulthuan', 'una guardia de los Asur', 'la hueste del Rey Fénix'],
    open: ['Con la gracia de Asuryan y la disciplina de siglos marcha', 'Desde las torres de Ulthuan, con orgullo inmortal, avanza'],
    cry: ['¡Por Ulthuan y el Rey Fénix!', 'El orgullo de los Asur no se doblega.'],
    troops: { inf: 'lanceros y maestros de la espada', missile: 'arqueros de puntería infalible', cav: 'príncipes a caballo', monster: 'grifos, fénix y dragones', art: 'lanzavirotes de Lothern' },
    magic: 'Los magos de Saphery dominan cada Viento de la Magia.', armour: 'El ithilmar protege a sus mejores guerreros.', fly: 'Sus monturas reinan en el cielo.', dread: 'Aun así, la sabiduría élfica recuerda que',
  },
  wh2_main_sc_def_dark_elves: {
    host: ['una hueste druchii', 'los corsarios de Naggaroth', 'un ejército del Rey Brujo'],
    open: ['Desde las Arcas Negras, con cadenas listas para nuevos esclavos, desembarca', 'Bajo el látigo y el odio de siglos avanza'],
    cry: ['¡Sangre para Khaine!', 'Que los débiles sirvan, que los fuertes gobiernen.'],
    troops: { inf: 'guerreros de rencor afilado', missile: 'ballesteros de repetición', cav: 'jinetes oscuros', monster: 'hidras y mantícoras', art: 'lanzavirotes del Rey Brujo' },
    magic: 'Las hechiceras druchii invocan magia oscura.', fear: 'Su crueldad es legendaria.', dread: 'Pero hasta el más cruel de los druchii sabe que',
  },
  wh_dlc05_sc_wef_wood_elves: {
    host: ['los guardianes de Athel Loren', 'una hueste asrai', 'los hijos del bosque'],
    open: ['Entre los árboles que susurran y el canto de los espíritus surge', 'Como una tormenta de hojas y flechas avanza'],
    cry: ['¡El bosque no perdona!', 'Athel Loren reclama lo que es suyo.'],
    troops: { inf: 'danzantes guerreros', missile: 'arqueros que no fallan', cav: 'jinetes salvajes', monster: 'espíritus de los árboles', art: 'antiguos guardianes' },
    magic: 'La magia del bosque fluye en sus venas.', fly: 'Halcones, águilas y dragones guardan el cielo.', dread: 'Pero el bosque también enseña que',
  },
  wh2_main_sc_lzd_lizardmen: {
    host: ['una hueste de los Antiguos', 'los guerreros del Gran Plan', 'las legiones de los Slann'],
    open: ['Siguiendo el Gran Plan de los Ancestrales avanza', 'Desde las ciudades-templo de Lustria marcha'],
    cry: ['¡El Gran Plan se cumplirá!', 'Los Antiguos lo previeron todo.'],
    troops: { inf: 'saurios de sangre fría', missile: 'eslizones con dardos venenosos', cav: 'jinetes de gélidos', monster: 'dinosaurios de guerra', art: 'reliquias de los Ancestrales' },
    magic: 'Los Slann canalizan un poder anterior a la historia.', armour: 'Sus escamas resisten como placas de acero.', fear: 'Bestias colosales hacen temblar el suelo.', dread: 'Aunque ni el Gran Plan ignora que',
  },
  wh2_main_sc_skv_skaven: {
    host: ['una plaga de alimañas', 'un enjambre del Clan', 'las hordas de la Gran Rata Cornuda'],
    open: ['Desde los túneles, chillando y empujándose unos a otros, surge', 'Con piedra bruja en los ojos y traición en el corazón emerge'],
    cry: ['¡Sí-sí, matar-matar!', '¡Por la Gran Rata Cornuda!'],
    troops: { inf: 'alimañas en número sin fin', missile: 'equipos de armas de piedra bruja', cav: 'ratas de presa', monster: 'ratas ogro y abominaciones', art: 'máquinas del Clan Skryre' },
    magic: 'Los videntes grises invocan rayos de piedra bruja.', fear: 'Sus abominaciones siembran el pánico.', dread: 'Aunque cualquier caudillo astuto sabe-sabe que',
  },
  wh2_dlc09_sc_tmb_tomb_kings: {
    host: ['las legiones de Nehekhara', 'un ejército del rey funerario', 'los guerreros eternos del desierto'],
    open: ['Desde las arenas de Nehekhara, despertado de su sueño eterno, marcha', 'Al toque de los sacerdotes funerarios se levanta'],
    cry: ['¡Por la gloria de Nehekhara!', 'Los reyes del desierto no olvidan.'],
    troops: { inf: 'esqueletos de disciplina eterna', missile: 'arqueros de hueso', cav: 'carros de los reyes', monster: 'constructos de piedra', art: 'catapultas de cráneos' },
    magic: 'La magia de Nehekhara sostiene sus huesos.', fear: 'Los vivos tiemblan ante los antiguos reyes.', dread: 'Pero hasta un rey eterno debe recordar que',
  },
  wh3_dlc29_sc_nag_undead_legions: {
    host: ['las Legiones de Nagash', 'el ejército del Gran Nigromante', 'las huestes de la Muerte'],
    open: ['A la voluntad de Nagash, que todo lo ve desde Nagashizzar, marcha', 'Como una marea de huesos y almas encadenadas avanza'],
    cry: ['Todo lo vivo será mío.', '¡Que el mundo entero sirva a la Muerte!'],
    troops: { inf: 'legiones de muertos', missile: 'arqueros sin alma', cav: 'jinetes espectrales', monster: 'colosos de hueso', art: 'máquinas de la muerte' },
    magic: 'La magia de Nagash fluye sin límite.', fear: 'Los vivos huyen ante su llegada.', dread: 'Aunque el Gran Nigromante sabe que',
  },
  wh_main_sc_grn_greenskins: {
    host: ['un ¡Waaagh!', 'una horda de pielesverdes', 'los muchachos del jefe'],
    open: ['¡Gritando, peleando entre ellos y oliendo a pelea viene', 'Con más ganas que orden, pero muchas ganas, viene'],
    cry: ['¡WAAAGH!', '¡A partir kráneoz!'],
    troops: { inf: 'muchachos con hachas y ganas', missile: 'goblins con flechas y mala puntería', cav: 'jinetes de jabalí y lobos', monster: 'trolls y gigantes', art: 'lanzapiedros y voladores goblin' },
    magic: 'Los chamanes vomitan la energía del ¡Waaagh!', fear: 'Sus bestias asustan hasta a otros orcos.', dread: 'Aunque hasta un kaudillo sabe que',
  },
  wh3_main_sc_ogr_ogre_kingdoms: {
    host: ['una tribu ogra', 'la panza en marcha', 'los tragones de las montañas'],
    open: ['Con hambre infinita y la tripa por delante llega', 'Haciendo temblar la tierra a cada paso avanza'],
    cry: ['¡Comer! ¡Comer! ¡COMER!', 'Todo lo que se mueve es comida.'],
    troops: { inf: 'ogros toro y glotones', missile: 'ogros con trabucos', cav: 'jinetes de dientes de sable', monster: 'bestias de las montañas', art: 'gnoblars con chatarra' },
    magic: 'Los matarifes cocinan magia con la sangre de sus víctimas.', fear: 'Nadie quiere ser la cena de un ogro.', dread: 'Aunque ni el ogro más grande olvida que',
  },
  wh3_main_sc_ksl_kislev: {
    host: ['las huestes de la Madre Patria', 'un ejército de Kislev', 'los defensores del norte'],
    open: ['Bajo el viento helado de las estepas, con la bendición de Ursun, cabalga', 'Defendiendo la frontera contra el Caos marcha'],
    cry: ['¡Por la Madre Patria!', '¡Ursun ruge con nosotros!'],
    troops: { inf: 'kossars y streltsi', missile: 'arqueros de las estepas', cav: 'lanceros alados y jinetes', monster: 'osos de guerra', art: 'la Pequeña Grom' },
    magic: 'Las Brujas de Hielo traen el invierno sobre el enemigo.', armour: 'Su acero ha resistido a las hordas del norte.', dread: 'Pero las estepas enseñan que',
  },
  wh3_main_sc_cth_cathay: {
    host: ['un ejército del Gran Catai', 'las legiones del Emperador Dragón', 'los guardianes de la Gran Muralla'],
    open: ['En armonía entre el Yin y el Yang, bajo la mirada del Emperador Dragón, avanza', 'Con la disciplina de la Gran Muralla marcha'],
    cry: ['¡Por el Emperador Dragón!', 'El equilibrio del mundo debe ser preservado.'],
    troops: { inf: 'guerreros de jade', missile: 'ballesteros celestiales', cav: 'jinetes de la llanura', monster: 'leones y dragones', art: 'cohetes y cañones de fuego' },
    magic: 'Los astromantes leen los cielos y doblegan los vientos.', armour: 'El jade protege a sus mejores guerreros.', dread: 'Aunque la armonía enseña que',
  },
  wh_main_sc_chs_chaos: {
    host: ['una partida de guerra del Caos', 'los elegidos de los Dioses Oscuros', 'una horda del norte'],
    open: ['Desde los Desiertos del Caos, con la mirada de los Dioses sobre sus hombros, desciende', 'Entre ruinas humeantes y cráneos amontonados marcha'],
    cry: ['¡Por los Dioses Oscuros!', '¡Sangre, gloria y ruina!'],
    troops: { inf: 'guerreros forjados en el Caos', missile: 'merodeadores con hachas arrojadizas', cav: 'caballeros del Caos', monster: 'engendros y monstruos mutantes', art: 'máquinas infernales' },
    magic: 'Los hechiceros del Caos retuercen la realidad.', armour: 'Su armadura está bendecida por los Dioses Oscuros.', fear: 'Su sola presencia quiebra la voluntad de los mortales.', dread: 'Pero hasta un elegido sabe que',
  },
  wh_dlc08_sc_nor_norsca: {
    host: ['una hueste norsca', 'los saqueadores del norte', 'un clan de Norsca'],
    open: ['Desde los fiordos helados, con hambre de saqueo, desembarca', 'Al grito de los dioses del norte avanza'],
    cry: ['¡Por los Dioses del Norte!', '¡Saqueo y gloria!'],
    troops: { inf: 'merodeadores del norte', missile: 'lanzadores de hachas', cav: 'jinetes de las tierras heladas', monster: 'mamuts y bestias del hielo', art: 'colmillos de mamut' },
    magic: 'Los chamanes invocan a los dioses de la tormenta.', fear: 'Sus bestias heladas siembran el terror.', dread: 'Pero los ancianos del norte saben que',
  },
  wh_dlc03_sc_bst_beastmen: {
    host: ['una manada de guerra', 'los hijos del Caos', 'una horda bestial'],
    open: ['Desde lo profundo del bosque, al sonido de los cuernos, irrumpe', 'Destrozando todo lo civilizado a su paso avanza'],
    cry: ['¡Destruid lo que construyeron!', '¡Gloria a la piedra de manada!'],
    troops: { inf: 'gors y ungors', missile: 'ungors hostigadores', cav: 'centigors salvajes', monster: 'minotauros y bestias del Caos', art: 'carros de bestias' },
    magic: 'Los chamanes bestiales invocan la magia salvaje.', fear: 'Su furia aterra a los civilizados.', dread: 'Aunque el más fiero de los bestias sabe que',
  },
  wh3_main_sc_kho_khorne: {
    host: ['una hueste del Dios de la Sangre', 'los elegidos de Khorne', 'una marea de sangre y bronce'],
    open: ['Al tronar de los cuernos de bronce y bajo cielos rojos irrumpe', 'Buscando cráneos para el Trono de Khorne avanza'],
    cry: ['¡Sangre para el Dios de la Sangre! ¡Cráneos para el Trono de Cráneos!', '¡Matad, mutilad, quemad!'],
    troops: { inf: 'desangradores y guerreros sedientos', missile: 'los pocos que disparan, porque Khorne prefiere el hacha', cav: 'jinetes de juggernauts', monster: 'demonios mayores y bestias de bronce', art: 'máquinas de matanza' },
    magic: 'Aunque Khorne desprecia la hechicería, sus heraldos traen la ira de su dios.', armour: 'El bronce de Khorne protege a sus favoritos.', fear: 'Su ferocidad hace temblar a cualquier mortal.', dread: 'Y aunque Khorne no tolera cobardes,',
  },
  wh3_main_sc_nur_nurgle: {
    host: ['una pestilencia en marcha', 'los hijos del Abuelo Nurgle', 'una hueste putrefacta'],
    open: ['Entre moscas, risas y el olor dulzón de la podredumbre avanza', 'Con la bendición del Abuelo Nurgle, lenta pero imparable, marcha'],
    cry: ['¡Compartid los regalos del Abuelo!', 'Todo se pudre, todo renace.'],
    troops: { inf: 'portadores de plaga incontables', missile: 'enjambres que escupen pestilencia', cav: 'bestias de Nurgle', monster: 'grandes inmundicias y horrores podridos', art: 'catapultas de plaga' },
    magic: 'Los hechiceros de la plaga reparten las enfermedades del Abuelo.', armour: 'Su carne podrida resiste golpes que matarían a cualquiera.', fear: 'Su visión revuelve el estómago de los vivos.', dread: 'Aun así, el Abuelo sabe que',
  },
  wh3_main_sc_sla_slaanesh: {
    host: ['un séquito del Príncipe Oscuro', 'los devotos de Slaanesh', 'una hueste de deseo y exceso'],
    open: ['Con perfumes embriagadores y risas crueles, danzando hacia la batalla, llega', 'Buscando nuevas sensaciones avanza'],
    cry: ['¡Por el Príncipe del Placer!', 'Que el dolor y el éxtasis sean uno.'],
    troops: { inf: 'diablillas de garras afiladas', missile: 'los pocos que disparan, pues prefieren el roce', cav: 'demonios corceles veloces', monster: 'guardianes de secretos y bestias seductoras', art: 'carros de Slaanesh' },
    magic: 'La magia de Slaanesh seduce y quiebra la mente.', fear: 'Su belleza aterradora paraliza al enemigo.', dread: 'Pero hasta el más hedonista sabe que',
  },
  wh3_main_sc_tze_tzeentch: {
    host: ['una conspiración del Cambiante', 'los hijos de Tzeentch', 'una hueste de fuego y cambio'],
    open: ['Entre llamas multicolores y planes dentro de planes surge', 'Como un hilo del destino que solo Tzeentch entiende avanza'],
    cry: ['¡Todo según lo planeado!', 'El cambio es inevitable.'],
    troops: { inf: 'horrores que cambian de forma', missile: 'demonios de fuego', cav: 'discos de Tzeentch', monster: 'señores del cambio y bestias de fuego', art: 'carros de fuego' },
    magic: 'La magia de Tzeentch arde en todos los colores.', fly: 'Discos y demonios dominan el cielo.', dread: 'Aunque el Gran Conspirador ya previó que',
  },
  wh3_main_sc_dae_daemons: {
    host: ['la hueste del Príncipe Demonio', 'un ejército de los Cuatro', 'los demonios sin dios'],
    open: ['Ascendido por los Dioses Oscuros, el Príncipe Demonio conduce a', 'Con la gloria de los Cuatro sobre sus alas avanza'],
    cry: ['¡Gloria a los Cuatro!', 'El Caos indiviso no tiene rival.'],
    troops: { inf: 'demonios de todos los dioses', missile: 'demonios de fuego', cav: 'jinetes demoníacos', monster: 'demonios mayores', art: 'máquinas infernales' },
    magic: 'La magia del Caos fluye sin freno.', fear: 'Su visión quiebra la mente de los mortales.', dread: 'Pero ni un demonio olvida que',
  },
  wh3_dlc23_sc_chd_chaos_dwarfs: {
    host: ['una legión de Zharr-Naggrund', 'los herreros del Caos', 'un ejército de Hashut'],
    open: ['Desde las forjas de Zharr-Naggrund, entre humo y esclavos, avanza', 'Con el fuego de Hashut en sus máquinas marcha'],
    cry: ['¡Por Hashut, el Padre de la Oscuridad!', 'Que ardan en nuestras forjas.'],
    troops: { inf: 'guerreros infernales y esclavos', missile: 'trabucos infernales', cav: 'toros de fuego', monster: 'bestias de bronce', art: 'cañones y máquinas de guerra' },
    magic: 'Los hechiceros de Hashut doblegan el fuego y la piedra.', armour: 'Su armadura negra resiste lo imposible.', fear: 'Sus máquinas de guerra aterrorizan a los esclavos y a los libres.', dread: 'Aunque hasta Hashut sabe que',
  },
};

const GENERIC: LoreVoice = {
  host: ['un ejército', 'una hueste'], open: ['Al frente de sus tropas marcha'], cry: ['¡A la batalla!'],
  troops: { inf: 'infantería', missile: 'tiradores', cav: 'caballería', monster: 'monstruos', art: 'máquinas de guerra' }, dread: 'Pero conviene recordar que',
};

export function voiceOf(subculture?: string): LoreVoice {
  return (subculture && V[subculture]) || GENERIC;
}

/** Elección estable (siempre la misma frase para el mismo ejército) pero distinta entre ejércitos */
export function pick<T>(list: T[], seed: string, salt = ''): T {
  let h = 2166136261;
  for (const ch of seed + salt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return list[Math.abs(h) % list.length];
}

/** Si la hueste va en plural ("los hijos del bosque"), el verbo final de la apertura también: "surge" -> "surgen" */
const PLURAL: Record<string, string> = {
  surge: 'surgen', avanza: 'avanzan', marcha: 'marchan', alza: 'alzan', desembarca: 'desembarcan', cabalga: 'cabalgan', desciende: 'descienden',
  emerge: 'emergen', irrumpe: 'irrumpen', llega: 'llegan', viene: 'vienen', despierta: 'despiertan', levanta: 'levantan',
};
export function openFor(open: string, host: string): string {
  if (!/^(los|las) /i.test(host)) return open;
  return open.replace(/(\S+)$/, (w) => PLURAL[w] ?? w);
}
