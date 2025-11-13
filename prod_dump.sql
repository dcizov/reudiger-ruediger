--
-- PostgreSQL database cluster dump
--

\restrict Tcg2Mod0wj0jOZoYM2HFvDPyE3p4cttYse2SUj5xotKgjQ9reB8oX7iO7JdeeeD

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE postgres;
ALTER ROLE postgres WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:kvwlUi9bRlKsqqDrI+o+dg==$+EiE2XJ+7jwZC2WYk5zIdx2x2zeRbrTuHOfFpaAGfbc=:abkywLz5NUtTi50ETvGIcJJf9SWt9oJLbmCPvgJ0F+s=';

--
-- User Configurations
--








\unrestrict Tcg2Mod0wj0jOZoYM2HFvDPyE3p4cttYse2SUj5xotKgjQ9reB8oX7iO7JdeeeD

--
-- Databases
--

--
-- Database "template1" dump
--

\connect template1

--
-- PostgreSQL database dump
--

\restrict lzUmTiVF635WzthOppcLdJc9TlYuHD3KXJA1obqyqW8P2FoymlAh9PqU9JbFT3D

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- PostgreSQL database dump complete
--

\unrestrict lzUmTiVF635WzthOppcLdJc9TlYuHD3KXJA1obqyqW8P2FoymlAh9PqU9JbFT3D

--
-- Database "postgres" dump
--

\connect postgres

--
-- PostgreSQL database dump
--

\restrict cXzmY6XlRzHlVwSwHh7YWn0aOhZk5G0uIO4mcevdtzEgLZ5J4LRzIBQ8Nyntf5e

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- PostgreSQL database dump complete
--

\unrestrict cXzmY6XlRzHlVwSwHh7YWn0aOhZk5G0uIO4mcevdtzEgLZ5J4LRzIBQ8Nyntf5e

--
-- Database "reudiger-ruediger" dump
--

--
-- PostgreSQL database dump
--

\restrict abr9lJlh8UxjVddx6Qxrec9SKknra5tb3kZOi1uwTiV97hrFu8iCbZLXloonEPL

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: reudiger-ruediger; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE "reudiger-ruediger" WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE "reudiger-ruediger" OWNER TO postgres;

\unrestrict abr9lJlh8UxjVddx6Qxrec9SKknra5tb3kZOi1uwTiV97hrFu8iCbZLXloonEPL
\encoding SQL_ASCII
\connect -reuse-previous=on "dbname='reudiger-ruediger'"
\restrict abr9lJlh8UxjVddx6Qxrec9SKknra5tb3kZOi1uwTiV97hrFu8iCbZLXloonEPL

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: postgres
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO postgres;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: postgres
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO postgres;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: postgres
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: bot_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bot_config (
    id integer NOT NULL,
    key character varying(64) NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.bot_config OWNER TO postgres;

--
-- Name: bot_config_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bot_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bot_config_id_seq OWNER TO postgres;

--
-- Name: bot_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bot_config_id_seq OWNED BY public.bot_config.id;


--
-- Name: news_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.news_settings (
    id integer NOT NULL,
    guild_id text NOT NULL,
    source text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    channel_id character varying(255)
);


ALTER TABLE public.news_settings OWNER TO postgres;

--
-- Name: news_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.news_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.news_settings_id_seq OWNER TO postgres;

--
-- Name: news_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.news_settings_id_seq OWNED BY public.news_settings.id;


--
-- Name: posted_deals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posted_deals (
    id integer NOT NULL,
    deal_id character varying(64) NOT NULL,
    message_id character varying(64) NOT NULL,
    title text NOT NULL,
    store text NOT NULL,
    platform text NOT NULL,
    sale_price character varying(32),
    normal_price character varying(32),
    savings character varying(16),
    deal_rating character varying(16),
    image_url text,
    url text,
    posted_at timestamp without time zone DEFAULT now(),
    posted_price real,
    lowest_ever boolean DEFAULT false,
    historical_low real,
    expires_at timestamp without time zone
);


ALTER TABLE public.posted_deals OWNER TO postgres;

--
-- Name: posted_deals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.posted_deals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.posted_deals_id_seq OWNER TO postgres;

--
-- Name: posted_deals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.posted_deals_id_seq OWNED BY public.posted_deals.id;


--
-- Name: posted_news; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posted_news (
    id integer NOT NULL,
    guid text NOT NULL,
    source text NOT NULL,
    guild_id text NOT NULL,
    message_id character varying(255),
    title text,
    posted_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.posted_news OWNER TO postgres;

--
-- Name: posted_news_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.posted_news_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.posted_news_id_seq OWNER TO postgres;

--
-- Name: posted_news_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.posted_news_id_seq OWNED BY public.posted_news.id;


--
-- Name: reaction_role_buttons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reaction_role_buttons (
    id integer NOT NULL,
    message_id character varying(255) NOT NULL,
    role_id character varying(255) NOT NULL,
    emoji character varying(100) NOT NULL,
    label character varying(100) NOT NULL,
    button_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    category character varying(100),
    requires_existing_roles boolean DEFAULT false,
    required boolean DEFAULT false
);


ALTER TABLE public.reaction_role_buttons OWNER TO postgres;

--
-- Name: reaction_role_buttons_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reaction_role_buttons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reaction_role_buttons_id_seq OWNER TO postgres;

--
-- Name: reaction_role_buttons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reaction_role_buttons_id_seq OWNED BY public.reaction_role_buttons.id;


--
-- Name: reaction_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reaction_roles (
    id integer NOT NULL,
    message_id character varying(255) NOT NULL,
    channel_id character varying(255) NOT NULL,
    guild_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reaction_roles OWNER TO postgres;

--
-- Name: reaction_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reaction_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reaction_roles_id_seq OWNER TO postgres;

--
-- Name: reaction_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reaction_roles_id_seq OWNED BY public.reaction_roles.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    user_id character varying(64) NOT NULL,
    username text NOT NULL,
    game_id character varying(128) NOT NULL,
    title text NOT NULL,
    historical_low integer,
    current_price integer,
    target_price integer,
    notified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscriptions_id_seq OWNER TO postgres;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: user_role_cooldowns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_role_cooldowns (
    id integer NOT NULL,
    user_id character varying(255) NOT NULL,
    guild_id character varying(255) NOT NULL,
    last_changed timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_role_cooldowns OWNER TO postgres;

--
-- Name: user_role_cooldowns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_role_cooldowns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_role_cooldowns_id_seq OWNER TO postgres;

--
-- Name: user_role_cooldowns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_role_cooldowns_id_seq OWNED BY public.user_role_cooldowns.id;


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_settings (
    id integer NOT NULL,
    user_id character varying(64) NOT NULL,
    notifications_enabled boolean DEFAULT true
);


ALTER TABLE public.user_settings OWNER TO postgres;

--
-- Name: user_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_settings_id_seq OWNER TO postgres;

--
-- Name: user_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_settings_id_seq OWNED BY public.user_settings.id;


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: bot_config id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bot_config ALTER COLUMN id SET DEFAULT nextval('public.bot_config_id_seq'::regclass);


--
-- Name: news_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_settings ALTER COLUMN id SET DEFAULT nextval('public.news_settings_id_seq'::regclass);


--
-- Name: posted_deals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posted_deals ALTER COLUMN id SET DEFAULT nextval('public.posted_deals_id_seq'::regclass);


--
-- Name: posted_news id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posted_news ALTER COLUMN id SET DEFAULT nextval('public.posted_news_id_seq'::regclass);


--
-- Name: reaction_role_buttons id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reaction_role_buttons ALTER COLUMN id SET DEFAULT nextval('public.reaction_role_buttons_id_seq'::regclass);


--
-- Name: reaction_roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reaction_roles ALTER COLUMN id SET DEFAULT nextval('public.reaction_roles_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: user_role_cooldowns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_role_cooldowns ALTER COLUMN id SET DEFAULT nextval('public.user_role_cooldowns_id_seq'::regclass);


--
-- Name: user_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings ALTER COLUMN id SET DEFAULT nextval('public.user_settings_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: postgres
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	ac723afb2cd82ca7610e7804e0cbf37e67a0b947db39778075ecb01d553d6f0a	1753832766906
2	da19ade42f56f85efb581e09574b6e2be115697c4cad19de59efe83ae32297f2	1762651464246
3	79c328746e9490bb8e22878ae1c8feb05b903e5648118efd8f8535ebb8a6d8d0	1762652830110
4	e1b5ee6d18b6d4c46e1be1100654b801976362cbc490d31dada824ef912d7ff1	1762692027796
5	a9145ee5b8de53dd551a78d65e69af41454dc5d6b58f83c82414de44d265a197	1762899536867
6	5a64fdaa410b61253f0754ec883e9da58f8438962dc70853cd0965f5aced885c	1762947093510
7	476715b6a1115f36e7a55f24843f40b144f14a87892523b8f153b20768e27f9d	1762958457000
\.


--
-- Data for Name: bot_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bot_config (id, key, value, updated_at) FROM stdin;
1	dealsChannelId	1399197399372533853	2025-11-13 00:20:34.674
9	newsChannelId	1436857465189699655	2025-11-13 00:20:34.717
3	logChannelId	1436708854510391448	2025-11-11 12:43:45.97353
\.


--
-- Data for Name: news_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.news_settings (id, guild_id, source, enabled, created_at, updated_at, channel_id) FROM stdin;
1	538721438925062158	cs2	t	2025-11-11 23:14:59.592643	2025-11-13 00:20:34.723	1438128136603701248
2	538721438925062158	wowRetail	t	2025-11-11 23:27:41.228448	2025-11-13 00:20:34.733	1436868252977467613
12	538721438925062158	wowInDev	t	2025-11-13 00:20:34.740889	2025-11-13 00:20:34.740889	1436868252977467613
6	538721438925062158	valheim	t	2025-11-11 23:28:53.678628	2025-11-13 00:20:34.745	1438128190831726713
\.


--
-- Data for Name: posted_deals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.posted_deals (id, deal_id, message_id, title, store, platform, sale_price, normal_price, savings, deal_rating, image_url, url, posted_at, posted_price, lowest_ever, historical_low, expires_at) FROM stdin;
1	zyGVQe8lhbM3BcfjZLODkZm4KQCRHoyiKuQ8XS1wVF4%3D	1437804087214215273	Rising Storm 2: Vietnam	Steam	Steam	1.14	22.99	95%	9.9	https://cdn.cloudflare.steamstatic.com/steam/apps/418460/header.jpg	https://itad.link/018d9386-bb37-7157-bb62-dd7240aa3287/	2025-11-11 14:00:07.818	1.14	f	1.09	2025-11-11 20:00:07.818
2	cdJntIN84g4dRo3rqt8izoxL1Xg%2FL2uOcACwHEmAjfI%3D	1437804089282003024	Monster Energy Supercross - The Official Videogame 2	Steam	Steam	1.99	19.99	90%	9.4	https://cdn.cloudflare.steamstatic.com/steam/apps/882020/header.jpg	https://itad.link/018d9386-9a25-7172-94ac-dc85db0af4d8/	2025-11-11 14:00:08.106	1.99	t	1.99	2025-11-11 20:00:08.106
3	T%2FEb%2F%2F5Ub09uPAveN6wFD6X9XoA77cwVvsFvkQJD2ow%3D	1437804091420966933	Crashlands	Steam	Steam	1.47	14.79	90%	9.2	https://cdn.cloudflare.steamstatic.com/steam/apps/391730/header.jpg	https://itad.link/018d9386-4279-72ca-a928-2b74a446961c/	2025-11-11 14:00:09.328	1.47	f	1	2025-11-11 20:00:09.328
4	SJtwMqHmcdHzhryD5NoKvH6Nnk%2BblWEhlew2F42uPHk%3D	1437804095653023855	Chariot	Steam	Steam	1.49	14.99	90%	9.2	https://cdn.cloudflare.steamstatic.com/steam/apps/319450/header.jpg	https://itad.link/018d9386-7989-736c-b8a0-eddd22909f91/	2025-11-11 14:00:09.722	1.49	f	0.78	2025-11-11 20:00:09.722
5	Gp%2BHwM23s%2FnB5jSfpr4HNm4Ljb3zqw1fQ5GvHfkenmk%3D	1437804097074892951	Orwells Animal Farm	GOG	Steam	0.99	9.99	90%	8.9	https://cdn.cloudflare.steamstatic.com/steam/apps/1398100/header.jpg	https://itad.link/018d9386-a719-7274-b209-51f6a3e8b828/	2025-11-11 14:00:09.987	0.99	t	0.99	2025-11-11 20:00:09.987
6	ocAxVNEdgkJ9Rayz8s9Aqxp71oywOCbdKf2VJS7bAtg%3D	1437819194707152906	The Smurfs - Mission Vileaf	Steam	Steam	1.99	19.99	90%	9.0	https://cdn.cloudflare.steamstatic.com/steam/apps/1502560/header.jpg	https://itad.link/018d9386-cb3c-73d2-807a-84a5f18275d3/	2025-11-11 15:00:09.639	1.99	f	1.66	2025-11-11 21:00:09.639
7	admoOLN6Tln7UU72VTvbAvh3QvdY5aJdsokvDd7BDUI%3D	1437819196535734413	Super Hydorah	Steam	Steam	1.99	19.99	90%	9.0	https://cdn.cloudflare.steamstatic.com/steam/apps/628800/header.jpg	https://itad.link/018d9386-d778-73e8-a4c5-ae76f473d8b1/	2025-11-11 15:00:10.022	1.99	t	1.99	2025-11-11 21:00:10.022
8	a89EMVSsRCcdcOq66D8l8kacyjsUCd6vYJ5rWBRtscw%3D	1437819197706076312	Worms Rumble	Fanatical	Steam	1.34	14.99	90%	8.8	https://cdn.cloudflare.steamstatic.com/steam/apps/1186040/header.jpg	https://itad.link/018d9386-f826-7279-820a-d66d4f5b54fd/	2025-11-11 15:00:10.411	1.34	f	0.78	2025-11-11 21:00:10.411
9	hNSy3u7enebTcmBQ%2B1mUe%2FDlUZsgFn5vOU4ThfEaRcc%3D	1437819199702433843	Dino D-Day	Steam	Steam	0.99	9.99	90%	8.5	https://cdn.cloudflare.steamstatic.com/steam/apps/70000/header.jpg	https://itad.link/018d9386-4d36-703a-9265-16409e6df3ae/	2025-11-11 15:00:10.827	0.99	f	0.49	2025-11-11 21:00:10.827
10	GB8HneaA6NVTLyE1S0gohuA0w5lbD3puUVvWD8RwgUo%3D	1437819200935825489	Trolley Problem, Inc.	Steam	Steam	1.09	10.99	90%	8.5	https://cdn.cloudflare.steamstatic.com/steam/apps/1582680/header.jpg	https://itad.link/018d9386-e8a9-736a-a7c2-209e5f084548/	2025-11-11 15:00:11.09	1.09	f	0.86	2025-11-11 21:00:11.09
11	Z9M0xyIRNKo%2FtehscZEH39Y3m8ETnooq3Du6tdgwoLk%3D	1438090966773792830	Roguebook	IndieGala Store	Steam	2.49	24.99	90%	9.3	https://cdn.cloudflare.steamstatic.com/steam/apps/1076200/header.jpg	https://itad.link/018d9583-d82e-7026-b8ed-ecd3f5ab2d1e/	2025-11-12 09:00:05.127	2.49	f	2.19	2025-11-12 15:00:05.127
12	1zn3gnxbiZzSj3THzTerATmN1IQaiyvk78AB5zGvJ9A%3D	1438090969273860107	Drug Dealer Simulator	Steam	Steam	1.67	16.79	90%	8.6	https://cdn.cloudflare.steamstatic.com/steam/apps/682990/header.jpg	https://itad.link/018d9386-52d8-7317-b0cc-419ea642a81d/	2025-11-12 09:00:05.637	1.67	f	1.26	2025-11-12 15:00:05.637
13	pP%2B23z60Cke6YjWGt3Ff3iYgb2a8uH4xgabCi3RdTUQ%3D	1438090969936564270	BADLAND: Game of the Year Edition	Steam	Steam	0.99	9.99	90%	8.3	https://cdn.cloudflare.steamstatic.com/steam/apps/269670/header.jpg	https://itad.link/018d9386-2ca1-7380-a16d-6ccff8cc474e/	2025-11-12 09:00:05.905	0.99	t	0.99	2025-11-12 15:00:05.905
14	gTj2xUQA1N8IIob7Zwd1C%2B%2FWFUlBoDGbEK11zztM0sY%3D	1438090971903688806	Moto Racer 4	Steam	Steam	1.49	14.99	90%	8.2	https://cdn.cloudflare.steamstatic.com/steam/apps/417430/header.jpg	https://itad.link/018d9386-9bc9-715f-99e1-180127eed5bc/	2025-11-12 09:00:06.304	1.49	f	0.65	2025-11-12 15:00:06.304
15	5xRuVIgFiH0TW2PTPJPlTN4NYMjAt4bg3p1CvKMMJv8%3D	1438090973770023014	Sid Meiers Civilization VI	Fanatical	Steam	2.99	59.99	90%	8.7	https://cdn.cloudflare.steamstatic.com/steam/apps/289070/header.jpg	https://itad.link/018d9386-c7eb-73ea-8d79-fdcc0d424962/	2025-11-12 09:00:06.83	2.99	f	2	2025-11-12 15:00:06.83
16	728MZcnVMYXwo9wIye%2F1b43YzDL1Hm8PgLFavwb1iew%3D	1438272174225100992	Beholder	GamersGate	Steam	0.94	13.79	94%	9.6	https://cdn.cloudflare.steamstatic.com/steam/apps/475550/header.jpg	https://itad.link/018d9386-2f99-7031-891d-3e446962bf36/	2025-11-12 21:00:08.391	0.94	f	0.5	2025-11-13 03:00:08.391
17	J3sW%2BauwYqn7qMPW5EMom4W9doRLGVBk9YFivi1e00s%3D	1438272175902560266	Beholder 2	GamersGate	Steam	1.18	17.49	90%	9.3	https://cdn.cloudflare.steamstatic.com/steam/apps/761620/header.jpg	https://itad.link/018d9386-2f9a-708f-a971-7caebd3ba506/	2025-11-12 21:00:08.655	1.18	f	1	2025-11-13 03:00:08.655
18	lCDsqso4TYeAJo1GunpuMb5X8SL3cWZWFQpHGem%2BdDk%3D	1438272183217426486	Beholder 3	GamersGate	Steam	1.18	17.49	90%	9.0	https://cdn.cloudflare.steamstatic.com/steam/apps/1570070/header.jpg	https://itad.link/018d9386-2f9b-7155-87a7-6d62d6b8f900/	2025-11-12 21:00:10.632	1.18	t	1.31	2025-11-13 03:00:10.632
19	Brh0Cx4GkEXEq8NnlGjK7HpcxJ3S%2FEvBSLriNO6CIp0%3D	1438272185822089237	Time Loader	Steam	Steam	1.16	7.79	85%	9.2	https://cdn.cloudflare.steamstatic.com/steam/apps/1301950/header.jpg	https://itad.link/018d9386-df6b-70df-8292-ec3d57b5eac7/	2025-11-12 21:00:11.141	1.16	f	0.78	2025-11-13 03:00:11.141
20	8363Pjy6vlJOgyt8s72D9xSCf%2B9f3nGmnrF9Oqxjo84%3D	1438272187952926821	Gato Roboto	GOG	Steam	0.99	6.59	85%	8.9	https://cdn.cloudflare.steamstatic.com/steam/apps/916730/header.jpg	https://itad.link/018d9386-6aab-7364-b108-fed4844ce64b/	2025-11-12 21:00:11.627	0.99	f	0.98	2025-11-13 03:00:11.627
21	7RNljMxtPHMG8%2FVCS2w%2Biyz75Xh0yz%2FLA%2FhlLT98%2F80%3D	1438453373383868447	Worms Reloaded	Fanatical	Steam	3.39	19.99	85%	8.6	https://cdn.cloudflare.steamstatic.com/steam/apps/22600/header.jpg	https://itad.link/018d9386-f820-722b-a845-bdc6d440428b/	2025-11-13 09:00:09.546	3.39	f	1.99	2025-11-13 15:00:09.546
22	wMQUyvWqpwNxZszrBnFYoHlB3Y1bAE4zvwxDq1%2B12IM%3D	1438453375921557571	Worms Revolution	Fanatical	Steam	2.54	14.99	85%	8.3	https://cdn.cloudflare.steamstatic.com/steam/apps/200170/header.jpg	https://itad.link/018d9386-f823-71e8-b309-130681258824/	2025-11-13 09:00:10.274	2.54	f	1.5	2025-11-13 15:00:10.274
23	mVlGEJb24RbzULlOMy%2B%2F%2Fxvc6XntIwRCCFGB8E9Iw2k%3D	1438453377859194891	Shakedown Hawaii	Steam	Steam	2.99	19.99	85%	8.4	https://cdn.cloudflare.steamstatic.com/steam/apps/598730/header.jpg	https://itad.link/018d9386-c4bc-70bc-befb-4ff2bd837dfb/	2025-11-13 09:00:10.644	2.99	t	2.99	2025-11-13 15:00:10.644
24	A7dKYx9o3AXtA%2FRXfgPeBLPnq1gteceeUhIiA4sLEMo%3D	1438453379339915355	Worms Ultimate Mayhem	Fanatical	Steam	2.20	12.99	85%	8.1	https://cdn.cloudflare.steamstatic.com/steam/apps/70600/header.jpg	https://itad.link/018d9386-f829-7321-a3cd-8af6dde75f24/	2025-11-13 09:00:10.919	2.2	f	1.3	2025-11-13 15:00:10.919
25	WMWlwiXWImNHrpZMgoImEUMUWFMbaO9sfjUupvOEszs%3D	1438453380594012170	XIII	Playsum	Steam	2.98	19.99	85%	8.3	https://cdn.cloudflare.steamstatic.com/steam/apps/1154790/header.jpg	https://itad.link/0192e3e1-c707-7286-906f-afa86fc8b243/	2025-11-13 09:00:11.288	2.98	f	0.89	2025-11-13 15:00:11.288
\.


--
-- Data for Name: posted_news; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.posted_news (id, guid, source, guild_id, message_id, title, posted_at) FROM stdin;
7	https://www.wowhead.com/news=379140	wowRetail	538721438925062158	1438215556988928010	Win Prizes with Player Housing in Wowhead's Housing Gallery Sweepstakes	2025-11-12 17:15:09.675068
8	https://www.wowhead.com/news=379232	wowRetail	538721438925062158	1438215558293229618	Final Manaforge Omega Raid Buff and Personal Teleport Unlocked at Renown Rank 15	2025-11-12 17:15:09.969019
9	https://www.wowhead.com/news=379207	wowRetail	538721438925062158	1438215559844991059	Keys Before Midnight - TWW Season 3 Mythic+ Rankings Week 13	2025-11-12 17:15:10.364814
14	https://www.wowhead.com/news=379209	wowRetail	538721438925062158	1438219300161847458	Outcast Specs of Manaforge - The War Within Season 3 DPS Rankings for Mythic Manaforge Omega Week 12	2025-11-12 17:30:02.176758
15	https://www.wowhead.com/news=379227	wowRetail	538721438925062158	1438219302942806139	Solo Delve Hall of Fame Expanded to 10.000 Players	2025-11-12 17:30:02.774312
16	https://www.wowhead.com/news=379239	wowRetail	538721438925062158	1438219304851079298	Customizable Haranir Druid Forms and Shapeshifts - Bear, Cat, and Travel Forms	2025-11-12 17:30:03.248537
17	https://www.wowhead.com/news=379250	wowRetail	538721438925062158	1438223092492013658	The Burning Crusade Anniversary Shop Bundle Images Discovered	2025-11-12 17:45:06.896723
18	https://www.wowhead.com/news=379241	wowRetail	538721438925062158	1438223096686448700	Test the Midnight Pre-Launch Event with Blizzard on November 17	2025-11-12 17:45:07.307077
19	https://www.wowhead.com/news=379240	wowRetail	538721438925062158	1438223098402045952	Blizzard Fixing Character Copy After Restart on Midnight Beta	2025-11-12 17:45:07.734735
20	https://www.wowhead.com/news=379237	wowRetail	538721438925062158	1438226844427096275	Ky'veza Delve Boss Nerfed	2025-11-12 18:00:01.010102
21	https://www.wowhead.com/news=379222	wowRetail	538721438925062158	1438226846838689803	Legion Remix Housing Rewards Datamined on the Midnight Beta	2025-11-12 18:00:01.476992
22	https://www.wowhead.com/news=379236	wowRetail	538721438925062158	1438226848818528319	Players Potentially Exploiting Legion Remix Keys - Are +200 Solo Keystones Possible?	2025-11-12 18:00:02.074851
23	https://www.wowhead.com/news=379251	wowRetail	538721438925062158	1438230626145796208	Patch 11.2.7 Release Date is December 2nd	2025-11-12 18:15:02.480617
24	https://www.wowhead.com/news=379220	wowRetail	538721438925062158	1438230627773190376	More New Mount Models with the Launch of Midnight Beta	2025-11-12 18:15:02.811266
25	https://www.wowhead.com/news=379219	wowRetail	538721438925062158	1438230629249712129	Cutting Edge Decor Rewards for Midnight - House Trophies for Raid Accomplishments	2025-11-12 18:15:03.269181
26	https://www.wowhead.com/news=379226	wowRetail	538721438925062158	1438234419214418082	Class Tuning is Starting - Midnight Beta Test Development Notes	2025-11-12 18:30:06.836702
27	https://www.wowhead.com/news=379221	wowRetail	538721438925062158	1438234420598542367	Mythic+ Affix Changes in Midnight	2025-11-12 18:30:07.217235
28	https://www.wowhead.com/news=379218	wowRetail	538721438925062158	1438234422900953148	New Dispel Icons on Raid Frames in Midnight Beta	2025-11-12 18:30:07.66704
29	https://www.wowhead.com/news=379216	wowRetail	538721438925062158	1438238195337924668	Datamined Midnight Beta Class Changes	2025-11-12 18:45:07.083368
30	https://www.wowhead.com/news=379213	wowRetail	538721438925062158	1438238196365525003	Midnight Login Screen Revealed with Launch of Beta	2025-11-12 18:45:07.407063
31	https://www.wowhead.com/news=379208	wowRetail	538721438925062158	1438238198307487804	Class Survival Guide for Midnight Beta: Changes You Need to Know	2025-11-12 18:45:07.846728
32	https://www.wowhead.com/news=379134	wowRetail	538721438925062158	1438241943099539589	New Mounts from Questing, Treasures & Rares in Midnight Alpha - Dragonhawks, Hawstriders & More!	2025-11-12 19:00:00.73036
33	https://www.wowhead.com/news=379203	wowRetail	538721438925062158	1438241945016074360	New Achievements for Training Grounds Coming to Midnight	2025-11-12 19:00:01.090596
34	https://www.wowhead.com/news=379176	wowRetail	538721438925062158	1438241946555388167	Get Instant Queues for Legion Assault Scenario in Legion Remix	2025-11-12 19:00:01.432
35	https://www.wowhead.com/news=379242	wowRetail	538721438925062158	1438245727129042994	Customizable Haranir Druid Forms and Shapeshifts - Moonkin, Aquatic, Flight, and Treant Forms	2025-11-12 19:15:02.971053
36	https://www.wowhead.com/news=379200	wowRetail	538721438925062158	1438245730115518546	Battle.net Mobile App Authenticator Restoration Issues	2025-11-12 19:15:03.493524
37	https://www.wowhead.com/news=379196	wowRetail	538721438925062158	1438245732049223684	Break The Meta with Raider.IO - The War Within Season 3	2025-11-12 19:15:04.049611
38	https://www.wowhead.com/news=379252	wowRetail	538721438925062158	1438249508239708220	AWC & MDl Grand Finals Begin November 14th & 21st	2025-11-12 19:30:04.435768
39	https://www.wowhead.com/news=379194	wowRetail	538721438925062158	1438249511544946839	Midnight Alpha Offline - Beta Begins November 11th	2025-11-12 19:30:05.052807
40	https://www.wowhead.com/news=379136	wowRetail	538721438925062158	1438249513268809900	New Warlock Sayaad Pet Customization in Midnight Alpha - Black Incubus from Nightbreaker Quest	2025-11-12 19:30:05.452752
41	https://www.wowhead.com/news=379178	wowRetail	538721438925062158	1438253267539988643	New Hunter Taming Item for Haranir Florafaun in Midnight	2025-11-12 19:45:00.560285
42	https://www.wowhead.com/news=379184	wowRetail	538721438925062158	1438253268584104059	Eversong Woods Campaign Playthrough - Chapter 3 (Story Spoilers)	2025-11-12 19:45:00.967503
43	https://www.wowhead.com/news=379139	wowRetail	538721438925062158	1438253270614409386	Heroic World Tier Inspires the New Prey Feature in Midnight	2025-11-12 19:45:01.290161
44	https://www.wowhead.com/news=379171	wowRetail	538721438925062158	1438257059660562572	New Mount Models Datamined from Midnight Alpha Phase 6	2025-11-12 20:00:04.687719
45	https://www.wowhead.com/news=379168	wowRetail	538721438925062158	1438257062168625183	Explore the Neighborhoods of Azeroth With Player Housing Music in Patch 11.2.7	2025-11-12 20:00:05.568531
46	https://www.wowhead.com/news=379182	wowRetail	538721438925062158	1438257064651526235	November 7th Hotfixes - Hidden Artifact Appearances & Class Mounts in Legion Remix	2025-11-12 20:00:05.921539
47	https://www.wowhead.com/news=379180	wowRetail	538721438925062158	1438260826845872250	Hints of The Burning Crusade Anniversary Pre-Purchase Packs Found in MoP Classic Hotfix	2025-11-12 20:15:02.92301
48	https://www.wowhead.com/news=379177	wowRetail	538721438925062158	1438260828699885721	Less Than 1% of Housing Decor Items are Currently Flagged as Shop Sources	2025-11-12 20:15:03.450219
49	https://www.wowhead.com/news=379174	wowRetail	538721438925062158	1438260830771875862	WoW Weekly: Legionfall Now Live, New Twitch Drop Ahead, and More!	2025-11-12 20:15:03.749936
50	https://www.wowhead.com/news=379172	wowRetail	538721438925062158	1438264603027964096	The Frog Farming of Legion Remix - Sentinax Infinite Power Farming	2025-11-12 20:30:03.225965
51	https://www.wowhead.com/news=379224	wowRetail	538721438925062158	1438294820765564958	New Trading Post Additions in Midnight - Flying Quilts, Mageweave Sets, Kaldorei Weapons	2025-11-12 22:30:07.696446
54	https://www.wowhead.com/news=379256	wowRetail	538721438925062158	1438313684148555960	New Midnight Dungeon Unlock Achievements Restrict Leveling Options for First Characters?	2025-11-12 23:45:05.060695
55	https://www.wowhead.com/news=379126	wowInDev	538721438925062158	1438325021247410310	Prepare For the Holiday Season With These New Collectibles From the Blizzard Gear Store	2025-11-13 00:30:07.975502
56	https://www.wowhead.com/news=379146	wowInDev	538721438925062158	1438325029103210627	BlizzCon 2026 Tickets On Sale Friday, November 7th - Early Bird Pricing is $249.99	2025-11-13 00:30:09.964721
57	https://www.wowhead.com/news=379148	wowInDev	538721438925062158	1438325037110394933	New Darkmoon Faire After Hours Add-On for BlizzCon 2026	2025-11-13 00:30:11.835523
58	https://www.wowhead.com/news=379056	wowInDev	538721438925062158	1438325044651757570	The Hasted Cooldown Conundrum - First Impression of Midnight Subtlety Rogue	2025-11-13 00:30:13.664081
59	https://www.wowhead.com/news=379149	wowInDev	538721438925062158	1438325052717404270	More Boss Mod Functionality Coming in Midnight - DBM & Big Wigs Meet with Ion Hazzikostas	2025-11-13 00:30:15.514815
60	https://www.wowhead.com/news=379154	wowInDev	538721438925062158	1438328793700896879	Addons Should Not Have Exclusive Functionality in Midnight - Ion Hazzikostas on Reddit	2025-11-13 00:45:07.522549
61	https://www.wowhead.com/news=379161	wowInDev	538721438925062158	1438328802185973760	Midnight Alpha Test Development Notes - Tier Sets, Class Changes, and UI	2025-11-13 00:45:09.422127
62	https://www.wowhead.com/news=379163	wowInDev	538721438925062158	1438328810008481854	Midnight Alpha Phase 6 Datamined Class and Spell Changes - More Tier, Rallying Cry Buff	2025-11-13 00:45:11.289397
63	https://www.wowhead.com/news=379162	wowInDev	538721438925062158	1438328817352572970	The Brutosaur Might Be Returning... But Only in China	2025-11-13 00:45:13.148258
64	https://www.wowhead.com/news=379165	wowInDev	538721438925062158	1438328825506431079	Track Interrupts and Dispels with the Built-In Damage Meter in Midnight	2025-11-13 00:45:14.962052
75	https://www.wowhead.com/news=379164	wowInDev	538721438925062158	1438332586354278502	Anu'shalla, Shadow's Guidance Mount - Obtained by Collecting 600 Total Mounts	2025-11-13 01:00:11.768156
76	https://www.wowhead.com/news=379169	wowInDev	538721438925062158	1438332594692554923	Rep Your Faction With These Horde & Alliance-Themed Collectibles From the Blizzard Gear Store	2025-11-13 01:00:13.638998
87	1809869179994587	valheim	538721438925062158	1438347644090191913	Patch 0.221.4 (Public Test)	2025-11-13 02:00:01.960451
88	1809869180193981	valheim	538721438925062158	1438347649685393520	Patch 0.221.4 – Call To Arms	2025-11-13 02:00:03.007691
89	1809869180199359	valheim	538721438925062158	1438347654534008953	The big Call to Arms update for Valheim is out now	2025-11-13 02:00:04.235752
90	1811138915391372	valheim	538721438925062158	1438351419727020062	Word From the Devs: We Fight On!	2025-11-13 02:15:01.908466
91	1814309641606284	valheim	538721438925062158	1438351424726630543	Word from the Devs: Picking Up the Thread	2025-11-13 02:15:03.069801
92	1815034432852394	cs2	538721438925062158	1438354865343565874	Counter-Strike 2 Update	2025-11-13 02:28:43.369196
93	1815580768210747	cs2	538721438925062158	1438354866387816549	Counter-Strike 2 Update	2025-11-13 02:28:43.621777
94	1815580768210748	cs2	538721438925062158	1438354867440717875	Introducing TrueView	2025-11-13 02:28:43.934958
95	1816215235365195	cs2	538721438925062158	1438355189009485927	The Starladder Budapest Major 2025	2025-11-13 02:30:00.598466
96	1816215235365196	cs2	538721438925062158	1438355190116782184	Counter-Strike 2 Update	2025-11-13 02:30:00.903739
97	https://www.wowhead.com/news=379214	wowRetail	538721438925062158	1438362753076297850	Secret Vendor Mount in Legion Remix - Unlock the Ability to Purchase the Fathom Dweller	2025-11-13 03:00:03.983108
98	https://www.wowhead.com/news=379235	wowRetail	538721438925062158	1438423160339955744	The Weekly Reset with Taliesin and Evitel: All About Hearthsteel	2025-11-13 07:00:06.544182
99	https://www.wowhead.com/news=379247	wowRetail	538721438925062158	1438483553045319701	Heroic (694 ilvl) Manaforge Omega Cache - The War Within Dungeon Event Now Live	2025-11-13 11:00:05.323797
\.


--
-- Data for Name: reaction_role_buttons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reaction_role_buttons (id, message_id, role_id, emoji, label, button_id, created_at, category, requires_existing_roles, required) FROM stdin;
3	1437847888251064536	1083829448891175032	🔫	CS2	role_1083829448891175032_1762880050366_2	2025-11-11 16:54:10.674423	\N	f	f
4	1437847888251064536	1083840929649135766	⚔️	WoW	role_1083840929649135766_1762880050366_3	2025-11-11 16:54:10.677308	\N	f	f
5	1437847888251064536	1396281844479037541	🛡️	Valheim	role_1396281844479037541_1762880050366_4	2025-11-11 16:54:10.681498	\N	f	f
2	1437847888251064536	540510589999382529	✅	Member	role_540510589999382529_1762880050366_1	2025-11-11 16:54:10.66007	\N	f	f
\.


--
-- Data for Name: reaction_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reaction_roles (id, message_id, channel_id, guild_id, created_at) FROM stdin;
2	1437847888251064536	1436821643870736534	538721438925062158	2025-11-11 16:54:10.64499
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscriptions (id, user_id, username, game_id, title, historical_low, current_price, target_price, notified, created_at) FROM stdin;
\.


--
-- Data for Name: user_role_cooldowns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_role_cooldowns (id, user_id, guild_id, last_changed) FROM stdin;
1	230348245509865475	538721438925062158	2025-11-11 17:34:02.453
\.


--
-- Data for Name: user_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_settings (id, user_id, notifications_enabled) FROM stdin;
1	230348245509865475	f
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: postgres
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 7, true);


--
-- Name: bot_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bot_config_id_seq', 51, true);


--
-- Name: news_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.news_settings_id_seq', 13, true);


--
-- Name: posted_deals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.posted_deals_id_seq', 25, true);


--
-- Name: posted_news_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.posted_news_id_seq', 99, true);


--
-- Name: reaction_role_buttons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reaction_role_buttons_id_seq', 5, true);


--
-- Name: reaction_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reaction_roles_id_seq', 2, true);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscriptions_id_seq', 1, true);


--
-- Name: user_role_cooldowns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_role_cooldowns_id_seq', 1, true);


--
-- Name: user_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_settings_id_seq', 1, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: bot_config bot_config_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bot_config
    ADD CONSTRAINT bot_config_key_unique UNIQUE (key);


--
-- Name: bot_config bot_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bot_config
    ADD CONSTRAINT bot_config_pkey PRIMARY KEY (id);


--
-- Name: news_settings news_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_settings
    ADD CONSTRAINT news_settings_pkey PRIMARY KEY (id);


--
-- Name: posted_deals posted_deals_deal_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posted_deals
    ADD CONSTRAINT posted_deals_deal_id_unique UNIQUE (deal_id);


--
-- Name: posted_deals posted_deals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posted_deals
    ADD CONSTRAINT posted_deals_pkey PRIMARY KEY (id);


--
-- Name: posted_news posted_news_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posted_news
    ADD CONSTRAINT posted_news_pkey PRIMARY KEY (id);


--
-- Name: reaction_role_buttons reaction_role_buttons_button_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reaction_role_buttons
    ADD CONSTRAINT reaction_role_buttons_button_id_unique UNIQUE (button_id);


--
-- Name: reaction_role_buttons reaction_role_buttons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reaction_role_buttons
    ADD CONSTRAINT reaction_role_buttons_pkey PRIMARY KEY (id);


--
-- Name: reaction_roles reaction_roles_message_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reaction_roles
    ADD CONSTRAINT reaction_roles_message_id_unique UNIQUE (message_id);


--
-- Name: reaction_roles reaction_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reaction_roles
    ADD CONSTRAINT reaction_roles_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: user_role_cooldowns user_role_cooldowns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_role_cooldowns
    ADD CONSTRAINT user_role_cooldowns_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_unique UNIQUE (user_id);


--
-- Name: news_settings_guild_source_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX news_settings_guild_source_unique ON public.news_settings USING btree (guild_id, source);


--
-- Name: posted_deals_expires_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX posted_deals_expires_at_idx ON public.posted_deals USING btree (expires_at);


--
-- Name: posted_news_guid_guild_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX posted_news_guid_guild_unique ON public.posted_news USING btree (guid, guild_id);


--
-- Name: posted_news_guild_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX posted_news_guild_id_idx ON public.posted_news USING btree (guild_id);


--
-- Name: posted_news_posted_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX posted_news_posted_at_idx ON public.posted_news USING btree (posted_at);


--
-- Name: posted_news_source_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX posted_news_source_idx ON public.posted_news USING btree (source);


--
-- Name: subscriptions_game_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX subscriptions_game_id_idx ON public.subscriptions USING btree (game_id);


--
-- Name: subscriptions_user_game_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX subscriptions_user_game_unique ON public.subscriptions USING btree (user_id, game_id);


--
-- Name: subscriptions_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX subscriptions_user_id_idx ON public.subscriptions USING btree (user_id);


--
-- Name: user_role_cooldowns_user_guild_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_role_cooldowns_user_guild_unique ON public.user_role_cooldowns USING btree (user_id, guild_id);


--
-- Name: reaction_role_buttons reaction_role_buttons_message_id_reaction_roles_message_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reaction_role_buttons
    ADD CONSTRAINT reaction_role_buttons_message_id_reaction_roles_message_id_fk FOREIGN KEY (message_id) REFERENCES public.reaction_roles(message_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict abr9lJlh8UxjVddx6Qxrec9SKknra5tb3kZOi1uwTiV97hrFu8iCbZLXloonEPL

--
-- PostgreSQL database cluster dump complete
--

