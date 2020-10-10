drop function public.balanceHistory;

CREATE OR REPLACE FUNCTION public.balanceHistory(_address varchar, _from timestamp, _to timestamp, _interval integer)
  RETURNS TABLE ("timestamp" timestamp, "value" numeric)
  LANGUAGE 'plpgsql'
  VOLATILE 
AS $BODY$
DECLARE
  timeIterator timestamp := _from;
  timeIteratorNext timestamp;
BEGIN
  LOOP
    timeIteratorNext := timeIterator + (_interval * interval '1 minute');

    RETURN QUERY
    SELECT timeIterator as "timestamp", coalesce(sum(pb.price*pb.balance), 0) as "value" FROM (
      SELECT
        (SELECT p.close FROM price p
          WHERE p.token = b.token AND p.datetime <= timeIteratorNext
          ORDER BY p.datetime DESC LIMIT 1) as price,
        b.balance
        FROM balance b
        WHERE b.address=_address
    ) as pb;

    EXIT WHEN timeIterator >= _to;

    timeIterator := timeIteratorNext;
  END LOOP;

END;
$BODY$;
