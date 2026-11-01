import FilterPanel from './FilterPanel'

export default function CallFilterPanel(props) {
  return (
    <FilterPanel
      variant="calllog"
      {...props}
      onClearFilters={props.onClearAllFilters || props.onClearFilters}
    />
  )
}
