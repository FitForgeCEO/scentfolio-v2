-- Adds WITH CHECK to all owner-pattern UPDATE policies that were missing it,
-- closing the row-ownership-transfer foot-gun. Each WITH CHECK mirrors the
-- existing USING clause exactly, so legitimate updates continue working --
-- the only thing that changes is that a user can no longer flip the owner
-- column to someone else's UID in an UPDATE.
--
-- ALTER POLICY syntax: leaving USING and TO unspecified retains existing values.

ALTER POLICY "Users can update their blind buys"        ON public.blind_buys        WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own list items"          ON public.custom_list_items WITH CHECK (EXISTS (SELECT 1 FROM custom_lists WHERE custom_lists.id = custom_list_items.list_id AND custom_lists.user_id = auth.uid()));
ALTER POLICY "Users can update own lists"               ON public.custom_lists      WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own decants"             ON public.decants           WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Submitters can update their dupes"        ON public.fragrance_dupes   WITH CHECK (auth.uid() = submitted_by);
ALTER POLICY "Users can update own journal entries"     ON public.journal_entries   WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own combos"              ON public.layering_combos   WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own stacks"              ON public.layering_stacks   WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update their own profile extras" ON public.profile_extras   WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own profile"             ON public.profiles          WITH CHECK (auth.uid() = id);
ALTER POLICY "Users can update own reviews"             ON public.reviews           WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update board items"             ON public.scent_board_items WITH CHECK (EXISTS (SELECT 1 FROM scent_boards WHERE scent_boards.id = scent_board_items.board_id AND scent_boards.user_id = auth.uid()));
ALTER POLICY "Users can update own boards"              ON public.scent_boards      WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update their own top shelf"     ON public.top_shelf         WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update their challenge progress" ON public.user_challenges  WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own collection"          ON public.user_collections  WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own signals"             ON public.user_signals      WITH CHECK (auth.uid() = user_id);
ALTER POLICY "Users can update own wear logs"           ON public.wear_logs         WITH CHECK (auth.uid() = user_id);
